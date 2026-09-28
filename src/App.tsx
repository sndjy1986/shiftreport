import { Suspense } from 'react';
import { HashRouter as Router } from 'react-router-dom';
import ShiftReport from './pages/ShiftReport';
import { Layout } from './components/centralhub/Layout';
import { PageWrapper } from './components/centralhub/PageWrapper';

export default function App() {
  return (
    <Router>
      <Layout>
        <Suspense fallback={<div className="w-full h-full bg-bg-main flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>}>
          <PageWrapper className="overflow-y-auto max-w-[1920px] mx-auto p-2 sm:p-6">
            <ShiftReport />
          </PageWrapper>
        </Suspense>
      </Layout>
    </Router>
  );
}
