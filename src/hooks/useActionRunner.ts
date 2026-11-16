import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Network } from '@capacitor/network';
import { friendlyError } from '../lib/friendlyError';

export type StepStatus = 'pending' | 'running' | 'waiting' | 'done' | 'failed';

export interface ActionStep<R = unknown> {
  id: string;
  label: string;
  run: (report: (detail: string) => void) => Promise<R>;
  describe?: (result: R) => string;
}

export interface StepState {
  id: string;
  label: string;
  status: StepStatus;
  detail: string;
}

export type ActionPhase = 'idle' | 'running' | 'waiting' | 'failed' | 'success';

export interface UseActionRunnerOptions {
  timeoutMs?: number;
}

export interface UseActionRunnerReturn {
  run: () => Promise<boolean>;
  retry: () => Promise<boolean>;
  reset: () => void;
  steps: StepState[];
  phase: ActionPhase;
  doneCount: number;
  total: number;
  failedStep: StepState | null;
  summary: string;
}

const DEFAULT_TIMEOUT_MS = 15000;
const OFFLINE_DETAIL = 'ইন্টারনেট নেই। সংযোগের অপেক্ষায়';
const TIMEOUT_DETAIL = 'সংযোগ ধীর, আবার চেষ্টা করবেন?';

function toInitialStates(steps: ActionStep<any>[]): StepState[] {
  return steps.map((s) => ({
    id: s.id,
    label: s.label,
    status: 'pending',
    detail: '',
  }));
}

export function useActionRunner(
  steps: ActionStep<any>[],
  opts?: UseActionRunnerOptions
): UseActionRunnerReturn {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const stepsRef = useRef<ActionStep<any>[]>(steps);
  stepsRef.current = steps;

  const [stepStates, setStepStates] = useState<StepState[]>(() => toInitialStates(steps));
  const [phase, setPhase] = useState<ActionPhase>('idle');
  const [summary, setSummary] = useState<string>('');

  const phaseRef = useRef<ActionPhase>('idle');
  phaseRef.current = phase;

  const stepStatesRef = useRef<StepState[]>(stepStates);
  stepStatesRef.current = stepStates;

  const runTokenRef = useRef<number>(0);
  const mountedRef = useRef<boolean>(true);
  const isOnlineRef = useRef<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const networkListenersRef = useRef<Set<(online: boolean) => void>>(new Set());

  const stepSignature = steps.map((s) => `${s.id}:${s.label}`).join('|');

  // Keep idle step list synchronized when caller updates step labels/ids before running
  useEffect(() => {
    if (phaseRef.current === 'idle') {
      const next = toInitialStates(stepsRef.current);
      stepStatesRef.current = next;
      setStepStates(next);
      setSummary('');
    }
  }, [stepSignature]);

  // Monitor both browser online/offline and Capacitor Network plugin
  useEffect(() => {
    mountedRef.current = true;
    let capHandle: { remove: () => Promise<void> } | null = null;

    const notifyOnlineChange = (online: boolean) => {
      if (isOnlineRef.current === online) return;
      isOnlineRef.current = online;
      networkListenersRef.current.forEach((cb) => {
        try {
          cb(online);
        } catch {
          // ignore listener callback error
        }
      });
    };

    const handleOnline = () => notifyOnlineChange(true);
    const handleOffline = () => notifyOnlineChange(false);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    Network.getStatus()
      .then((status) => {
        if (!mountedRef.current) return;
        const online =
          Boolean(status.connected) &&
          (typeof navigator === 'undefined' || navigator.onLine !== false);
        notifyOnlineChange(online);
      })
      .catch(() => {
        // Fallback silently to navigator.onLine on web/desktop if Capacitor bridge unavailable
      });

    Network.addListener('networkStatusChange', (status) => {
      if (!mountedRef.current) return;
      const online =
        Boolean(status.connected) &&
        (typeof navigator === 'undefined' || navigator.onLine !== false);
      notifyOnlineChange(online);
    })
      .then((handle) => {
        if (!mountedRef.current) {
          handle.remove().catch(() => undefined);
          return;
        }
        capHandle = handle;
      })
      .catch(() => undefined);

    return () => {
      mountedRef.current = false;
      runTokenRef.current += 1;
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
      if (capHandle) {
        capHandle.remove().catch(() => undefined);
      }
    };
  }, []);

  const updateStepAt = useCallback((index: number, patch: Partial<StepState>) => {
    if (!mountedRef.current) return;
    setStepStates((prev) => {
      const next = prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item));
      stepStatesRef.current = next;
      return next;
    });
  }, []);

  const waitUntilOnline = useCallback((token: number): Promise<boolean> => {
    if (isOnlineRef.current) return Promise.resolve(true);
    return new Promise((resolve) => {
      const onStatus = (online: boolean) => {
        if (!mountedRef.current || runTokenRef.current !== token) {
          networkListenersRef.current.delete(onStatus);
          resolve(false);
          return;
        }
        if (online) {
          networkListenersRef.current.delete(onStatus);
          resolve(true);
        }
      };
      networkListenersRef.current.add(onStatus);
    });
  }, []);

  const runSingleStepWithNetworkAndTimeout = useCallback(
    async (
      index: number,
      step: ActionStep<any>,
      token: number
    ): Promise<{ ok: true; result: unknown } | { ok: false; reason: string; timedOut?: boolean }> => {
      while (mountedRef.current && runTokenRef.current === token) {
        // 1. If currently offline before starting, enter 'waiting' state and pause
        if (!isOnlineRef.current) {
          phaseRef.current = 'waiting';
          setPhase('waiting');
          updateStepAt(index, { status: 'waiting', detail: OFFLINE_DETAIL });
          const resumed = await waitUntilOnline(token);
          if (!resumed || !mountedRef.current || runTokenRef.current !== token) {
            return { ok: false, reason: 'বাতিল করা হয়েছে' };
          }
        }

        // 2. Start awaited operation
        let latestReport = '';
        let wentOfflineDuringAttempt = false;
        phaseRef.current = 'running';
        setPhase('running');
        updateStepAt(index, { status: 'running', detail: '' });

        const outcome = await new Promise<
          | { kind: 'resolved'; result: unknown }
          | { kind: 'rejected'; error: unknown }
          | { kind: 'timeout' }
          | { kind: 'cancelled' }
        >((resolve) => {
          let settled = false;
          let remainingMs = timeoutMs;
          let timerId: number | null = null;
          let activeSince = Date.now();

          const cleanup = () => {
            if (timerId !== null) {
              window.clearTimeout(timerId);
              timerId = null;
            }
            networkListenersRef.current.delete(onNetChange);
          };

          const finish = (
            val:
              | { kind: 'resolved'; result: unknown }
              | { kind: 'rejected'; error: unknown }
              | { kind: 'timeout' }
              | { kind: 'cancelled' }
          ) => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(val);
          };

          const armTimer = () => {
            if (timerId !== null) {
              window.clearTimeout(timerId);
              timerId = null;
            }
            if (!isOnlineRef.current) return;
            activeSince = Date.now();
            timerId = window.setTimeout(() => {
              if (!mountedRef.current || runTokenRef.current !== token) {
                finish({ kind: 'cancelled' });
                return;
              }
              if (!isOnlineRef.current) {
                // Edge case: went offline just as timer fired
                return;
              }
              finish({ kind: 'timeout' });
            }, Math.max(100, remainingMs));
          };

          const pauseTimer = () => {
            if (timerId !== null) {
              const elapsed = Date.now() - activeSince;
              remainingMs = Math.max(100, remainingMs - elapsed);
              window.clearTimeout(timerId);
              timerId = null;
            }
          };

          const onNetChange = (online: boolean) => {
            if (settled || !mountedRef.current || runTokenRef.current !== token) return;
            if (!online) {
              wentOfflineDuringAttempt = true;
              pauseTimer();
              phaseRef.current = 'waiting';
              setPhase('waiting');
              updateStepAt(index, { status: 'waiting', detail: OFFLINE_DETAIL });
            } else {
              phaseRef.current = 'running';
              setPhase('running');
              updateStepAt(index, { status: 'running', detail: latestReport });
              armTimer();
            }
          };

          networkListenersRef.current.add(onNetChange);
          armTimer();

          const report = (detail: string) => {
            if (settled || !mountedRef.current || runTokenRef.current !== token) return;
            latestReport = detail;
            if (isOnlineRef.current) {
              updateStepAt(index, { detail });
            }
          };

          Promise.resolve()
            .then(() => step.run(report))
            .then(
              (result) => {
                if (!mountedRef.current || runTokenRef.current !== token) {
                  finish({ kind: 'cancelled' });
                  return;
                }
                finish({ kind: 'resolved', result });
              },
              (error) => {
                if (!mountedRef.current || runTokenRef.current !== token) {
                  finish({ kind: 'cancelled' });
                  return;
                }
                finish({ kind: 'rejected', error });
              }
            );
        });

        if (outcome.kind === 'cancelled' || !mountedRef.current || runTokenRef.current !== token) {
          return { ok: false, reason: 'বাতিল করা হয়েছে' };
        }

        if (outcome.kind === 'resolved') {
          // If connection dropped right before resolving locally, wait until back online before confirming done
          if (!isOnlineRef.current) {
            phaseRef.current = 'waiting';
            setPhase('waiting');
            updateStepAt(index, { status: 'waiting', detail: OFFLINE_DETAIL });
            const resumed = await waitUntilOnline(token);
            if (!resumed || !mountedRef.current || runTokenRef.current !== token) {
              return { ok: false, reason: 'বাতিল করা হয়েছে' };
            }
          }
          const finalDetail = step.describe
            ? step.describe(outcome.result)
            : latestReport || 'সম্পন্ন';
          updateStepAt(index, { status: 'done', detail: finalDetail });
          return { ok: true, result: outcome.result };
        }

        if (outcome.kind === 'timeout') {
          return { ok: false, reason: TIMEOUT_DETAIL, timedOut: true };
        }

        // outcome.kind === 'rejected'
        const mappedMsg = friendlyError(outcome.error);
        const isOfflineOrNetworkDrop =
          !isOnlineRef.current ||
          (wentOfflineDuringAttempt && mappedMsg === 'ইন্টারনেট সংযোগ যাচাই করুন');

        if (isOfflineOrNetworkDrop) {
          phaseRef.current = 'waiting';
          setPhase('waiting');
          updateStepAt(index, { status: 'waiting', detail: OFFLINE_DETAIL });
          const resumed = await waitUntilOnline(token);
          if (!resumed || !mountedRef.current || runTokenRef.current !== token) {
            return { ok: false, reason: 'বাতিল করা হয়েছে' };
          }
          // Retry interrupted step automatically once back online
          continue;
        }

        return { ok: false, reason: mappedMsg };
      }

      return { ok: false, reason: 'বাতিল করা হয়েছে' };
    },
    [timeoutMs, updateStepAt, waitUntilOnline]
  );

  const executeSteps = useCallback(
    async (mode: 'fresh' | 'retry'): Promise<boolean> => {
      if (phaseRef.current === 'running' || phaseRef.current === 'waiting') {
        return false;
      }

      const currentSteps = stepsRef.current;
      if (currentSteps.length === 0) return false;

      const token = ++runTokenRef.current;

      // Prepare step states
      let baseStates: StepState[];
      if (mode === 'fresh') {
        baseStates = toInitialStates(currentSteps);
      } else {
        baseStates = currentSteps.map((s, idx) => {
          const prev = stepStatesRef.current[idx];
          if (prev && prev.id === s.id && prev.status === 'done') {
            return prev;
          }
          return {
            id: s.id,
            label: s.label,
            status: 'pending',
            detail: '',
          };
        });
      }

      stepStatesRef.current = baseStates;
      setStepStates(baseStates);
      setSummary('');
      phaseRef.current = 'running';
      setPhase('running');

      const finalDetails: string[] = baseStates.map((s) => s.detail);

      for (let i = 0; i < currentSteps.length; i++) {
        if (!mountedRef.current || runTokenRef.current !== token) {
          return false;
        }

        if (baseStates[i].status === 'done') {
          continue;
        }

        const res = await runSingleStepWithNetworkAndTimeout(i, currentSteps[i], token);
        if (!mountedRef.current || runTokenRef.current !== token) {
          return false;
        }

        if (!res.ok) {
          updateStepAt(i, { status: 'failed', detail: res.reason });
          phaseRef.current = 'failed';
          setPhase('failed');
          return false;
        }

        const step = currentSteps[i];
        finalDetails[i] = step.describe
          ? step.describe(res.result)
          : stepStatesRef.current[i]?.detail || 'সম্পন্ন';
      }

      if (!mountedRef.current || runTokenRef.current !== token) {
        return false;
      }

      const combinedSummary =
        finalDetails.filter((d) => d && d.trim().length > 0).join(' · ') || 'সবগুলো ধাপ সম্পন্ন হয়েছে';
      setSummary(combinedSummary);
      phaseRef.current = 'success';
      setPhase('success');
      return true;
    },
    [runSingleStepWithNetworkAndTimeout, updateStepAt]
  );

  const run = useCallback(() => executeSteps('fresh'), [executeSteps]);
  const retry = useCallback(() => executeSteps('retry'), [executeSteps]);

  const reset = useCallback(() => {
    runTokenRef.current += 1;
    const next = toInitialStates(stepsRef.current);
    stepStatesRef.current = next;
    phaseRef.current = 'idle';
    setStepStates(next);
    setPhase('idle');
    setSummary('');
  }, []);

  const doneCount = useMemo(
    () => stepStates.filter((s) => s.status === 'done').length,
    [stepStates]
  );

  const failedStep = useMemo(
    () => stepStates.find((s) => s.status === 'failed') || null,
    [stepStates]
  );

  return {
    run,
    retry,
    reset,
    steps: stepStates,
    phase,
    doneCount,
    total: stepStates.length,
    failedStep,
    summary,
  };
}
