import { Suspense } from 'react';
import ShiftReport from './pages/ShiftReport';

export default function App() {
  return (
    <Suspense fallback={<div className="w-full h-screen bg-bg-main flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <div className="min-h-screen bg-bg-main overflow-y-auto">
        <ShiftReport />
      </div>
    </Suspense>
  );
}
