import React from 'react';
import { Routes, Route } from 'react-router-dom';
import TraineeList from './Trainees/TraineeList';
import TraineeForm from './Trainees/TraineeForm';
import TraineeProfile from './Trainees/TraineeProfile';

const Trainees: React.FC = () => {
  return (
    <Routes>
      <Route index element={<TraineeList />} />
      <Route path="add" element={<TraineeForm />} />
      <Route path="edit/:id" element={<TraineeForm />} />
      <Route path=":id" element={<TraineeProfile />} />
    </Routes>
  );
};

export default Trainees;
