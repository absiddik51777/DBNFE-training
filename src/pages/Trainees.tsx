import React from 'react';
import { Routes, Route } from 'react-router-dom';
import TraineeList from './Trainees/TraineeList';
import TraineeForm from './Trainees/TraineeForm';
import TraineeProfile from './Trainees/TraineeProfile';
import { RequireRole } from '../components/auth/RequireRole';

const Trainees: React.FC = () => {
  return (
    <Routes>
      <Route index element={<TraineeList />} />
      <Route
        path="add"
        element={
          <RequireRole permission="create_trainee" redirectTo="/trainees">
            <TraineeForm />
          </RequireRole>
        }
      />
      <Route
        path="edit/:id"
        element={
          <RequireRole permission="edit_trainee" redirectTo="/trainees">
            <TraineeForm />
          </RequireRole>
        }
      />
      <Route
        path=":id"
        element={
          <RequireRole permission="view_trainee_details" redirectTo="/trainees">
            <TraineeProfile />
          </RequireRole>
        }
      />
    </Routes>
  );
};

export default Trainees;
