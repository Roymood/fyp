import React from 'react';
import ResetPassword from '../components/auth/ResetPassword';

const ResetPasswordPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
        <ResetPassword />
      </div>
    </div>
  );
};

export default ResetPasswordPage;