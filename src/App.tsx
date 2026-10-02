import { Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import ShiftReport from './pages/ShiftReport';
import { Layout } from './components/centralhub/Layout';
import { PageWrapper } from './components/centralhub/PageWrapper';

const Timers = lazy(() => import('./pages/Timers'));

export default function App() {
  return (
    <Router>
      <Layout>
        <Suspense fallback={<div className="w-full h-full bg-bg-main flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>}>
          <Routes>
            <Route 
              path="/" 
              element={
                <PageWrapper className="overflow-y-auto max-w-[1920px] mx-auto p-2 sm:p-6">
                  <ShiftReport />
                </PageWrapper>
              } 
            />
            <Route 
              path="/shift-report" 
              element={
                <PageWrapper className="overflow-y-auto max-w-[1920px] mx-auto p-2 sm:p-6">
                  <ShiftReport />
                </PageWrapper>
              } 
            />
            <Route 
              path="/timers" 
              element={
                <PageWrapper fullWidth className="overflow-y-auto max-w-[1920px] mx-auto p-2 sm:p-6">
                  <Timers />
                </PageWrapper>
              } 
            />
            {/* Fallback to Shift Report */}
            <Route 
              path="*" 
              element={
                <PageWrapper className="overflow-y-auto max-w-[1920px] mx-auto p-2 sm:p-6">
                  <ShiftReport />
                </PageWrapper>
              } 
            />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  );
}
