import React, { useState, useEffect } from 'react';
import { logActivity } from '../../lib/firebase';
import { Plus, Edit2, Trash2, Eye, Search, Filter, Download, UserCheck, ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react';
import { Trainee, Institute, Trade, Batch } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { dataService } from '../../lib/dataService';

const ITEMS_PER_PAGE = 10;

const TraineeList: React.FC = () => {
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters
  const [filterInstitute, setFilterInstitute] = useState('');
  const [filterTrade, setFilterTrade] = useState('');
  const [filterBatch, setFilterBatch] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  
  const { userProfile } = useAuth();
  const canEdit = userProfile?.role === 'Course Director' || userProfile?.role === 'FMA';

  useEffect(() => {
    fetchData();
  }, [userProfile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [instData, tradesData, batchesData, traineesData] = await Promise.all([
        dataService.getItems<Institute>('institutes'),
        dataService.getItems<Trade>('trades'),
        dataService.getItems<Batch>('batches'),
        dataService.getItems<Trainee>('trainees')
      ]);
      
      setInstitutes(instData);
      setTrades(tradesData);
      setBatches(batchesData);

      let list = traineesData;
      
      // If user is a Trainer with assigned institute, auto-filter to their institute
      if (userProfile?.role === 'Trainer' && userProfile.instituteId) {
        list = list.filter(t => t.instituteId === userProfile.instituteId);
        setFilterInstitute(userProfile.instituteId);
      }

      setTrainees(list);
    } catch (error) {
      console.warn("Notice fetching trainees:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter & Search logic
  const filteredTrainees = trainees.filter((t) => {
    const matchSearch =
      !searchTerm ||
      t.nameEn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.nameBn?.includes(searchTerm) ||
      t.registrationNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.traineeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.mobileNumber?.includes(searchTerm);

    const matchInst = !filterInstitute || t.instituteId === filterInstitute;
    const matchTrade = !filterTrade || t.tradeId === filterTrade;
    const matchBatch = !filterBatch || t.batchId === filterBatch;
    const matchGender = !filterGender || t.gender === filterGender;
    const matchStatus = !filterStatus || t.status === filterStatus;

    return matchSearch && matchInst && matchTrade && matchBatch && matchGender && matchStatus;
  });

  // Pagination calculation
  const totalPages = Math.ceil(filteredTrainees.length / ITEMS_PER_PAGE) || 1;
  const paginatedList = filteredTrainees.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleDelete = async (trainee: Trainee) => {
    if (!canEdit) return;
    const confirmed = window.confirm(
      `আপনি কি নিশ্চিতভাবে "${trainee.nameEn} (${trainee.nameBn})" এর সকল তথ্য মুছে ফেলতে চান?\n\n(পরামর্শ: তথ্য স্থায়ীভাবে না মুছে স্ট্যাটাস "ঝরে পড়া" বা "নিষ্ক্রিয়" করতে পারেন।)`
    );
    if (confirmed) {
      try {
        await dataService.deleteItem('trainees', trainee.id);
        logActivity(
          userProfile?.id || '',
          userProfile?.name || 'User',
          `প্রশিক্ষণার্থী মুছে ফেলা হয়েছে: ${trainee.nameEn} (${trainee.registrationNumber})`,
          'Trainees',
          trainee.id
        );
        fetchData();
      } catch (error) {
        console.warn("Notice deleting trainee:", error);
      }
    }
  };

  const exportCSV = () => {
    if (filteredTrainees.length === 0) {
      alert("কোনো তথ্য নেই।");
      return;
    }

    let csv = 'ID,Registration No,Name (EN),Name (BN),Mobile,Gender,Institute,Trade,Batch,Status\n';
    filteredTrainees.forEach((t) => {
      const inst = institutes.find(i => i.id === t.instituteId)?.name || '';
      const trd = trades.find(tr => tr.id === t.tradeId)?.name || '';
      const btc = batches.find(b => b.id === t.batchId)?.name || '';
      csv += `"${t.traineeId || ''}","${t.registrationNumber}","${t.nameEn}","${t.nameBn}","${t.mobileNumber}","${t.gender}","${inst}","${trd}","${btc}","${t.status}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `trainees_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getInstituteName = (id: string) => institutes.find(i => i.id === id)?.name || '-';
  const getTradeName = (id: string) => trades.find(t => t.id === id)?.name || '-';
  const getBatchName = (id: string) => batches.find(t => t.id === id)?.name || '-';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-slate-500">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>প্রশিক্ষণার্থী তালিকা লোড হচ্ছে...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">প্রশিক্ষণার্থী তালিকা (Trainee List)</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            মোট নথিভুক্ত শিক্ষার্থী: {trainees.length} জন (ফিল্টারকৃত: {filteredTrainees.length} জন)
          </p>
        </div>
        <div className="flex items-center space-x-2.5">
          <button
            onClick={exportCSV}
            className="px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-semibold flex items-center space-x-1.5 shadow-2xs transition"
          >
            <Download size={16} />
            <span>এক্সপোর্ট (CSV)</span>
          </button>
          <Link
            to="/trainees/add"
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold flex items-center space-x-1.5 shadow-sm transition"
          >
            <Plus size={18} />
            <span>নতুন শিক্ষার্থী ভর্তি</span>
          </Link>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="relative">
          <input
            type="text"
            placeholder="নাম, রেজিস্ট্রেশন নম্বর, আইডি অথবা মোবাইল নম্বর দিয়ে খুঁজুন..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">প্রতিষ্ঠান</label>
            <select
              value={filterInstitute}
              onChange={(e) => { setFilterInstitute(e.target.value); setCurrentPage(1); }}
              disabled={userProfile?.role === 'Trainer' && !!userProfile.instituteId}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">সকল প্রতিষ্ঠান</option>
              {institutes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">ট্রেড</label>
            <select
              value={filterTrade}
              onChange={(e) => { setFilterTrade(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">সকল ট্রেড</option>
              {trades.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">ব্যাচ</label>
            <select
              value={filterBatch}
              onChange={(e) => { setFilterBatch(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">সকল ব্যাচ</option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">লিঙ্গ</label>
            <select
              value={filterGender}
              onChange={(e) => { setFilterGender(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">সকল</option>
              <option value="Male">পুরুষ (Male)</option>
              <option value="Female">নারী (Female)</option>
              <option value="Other">অন্যান্য</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">স্ট্যাটাস</label>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">সকল অবস্থা</option>
              <option value="Active">সক্রিয় (Active)</option>
              <option value="Completed">সম্পন্ন (Completed)</option>
              <option value="Dropped Out">ঝরে পড়া (Dropped Out)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Trainees Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">রেজিঃ ও আইডি</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">নাম</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">প্রতিষ্ঠান ও ট্রেড</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">ব্যাচ</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">মোবাইল</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">স্ট্যাটাস</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    কোনো প্রশিক্ষণার্থী পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                paginatedList.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-800">{t.registrationNumber}</div>
                      <div className="text-[11px] text-slate-400 font-mono">ID: {t.traineeId || 'N/A'}</div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-slate-800">{t.nameBn}</div>
                      <div className="text-xs text-slate-500">{t.nameEn}</div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="text-xs font-medium text-slate-800">{getInstituteName(t.instituteId)}</div>
                      <div className="text-xs text-emerald-600 font-medium">{getTradeName(t.tradeId)}</div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-600 font-medium">
                      {getBatchName(t.batchId)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-600 font-mono">
                      {t.mobileNumber}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                        t.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                        t.status === 'Completed' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {t.status === 'Active' ? 'সক্রিয়' : t.status === 'Completed' ? 'সম্পন্ন' : 'ঝরে পড়া'}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-1.5">
                        <Link
                          to={`/trainees/${t.id}`}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                          title="প্রোফাইল দেখুন"
                        >
                          <Eye size={17} />
                        </Link>
                        {canEdit && (
                          <>
                            <Link
                              to={`/trainees/edit/${t.id}`}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="সম্পাদনা"
                            >
                              <Edit2 size={17} />
                            </Link>
                            <button
                              onClick={() => handleDelete(t)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="মুছে ফেলুন"
                            >
                              <Trash2 size={17} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>
              পৃষ্ঠা {currentPage} / {totalPages}
            </span>
            <div className="flex items-center space-x-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 transition"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TraineeList;
