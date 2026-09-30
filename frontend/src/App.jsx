import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import PromptDetail from "./pages/dashboard/PromptDetail";


// Dashboard shell + pages
import DashboardLayout from "./components/dashboard/DashboardLayout";
import Overview from "./pages/dashboard/Overview";
import Prompts from "./pages/dashboard/Prompts";
import NewPrompt from "./pages/dashboard/NewPrompt";
import Executions from "./pages/dashboard/Executions";
import ExecutionDetail from "./pages/dashboard/ExecutionDetail";
import Comparisons from "./pages/dashboard/Comparisons";
import Analytics from "./pages/dashboard/Analytics";
import Evaluations from "./pages/dashboard/Evaluations";
import RunEvaluation from "./pages/dashboard/RunEvaluation";
import EvaluationResult from "./pages/dashboard/EvaluationResult";


// Placeholder for future pages — swap out when built
function ComingSoon({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 font-serif text-2xl text-ink">Coming soon</p>
      <p className="mt-1 text-sm text-muted">This section is under construction.</p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />}/>
        <Route path="/reset-password/:uid/:token" element={<ResetPassword />}/>
        <Route path="/prompts" element={<Prompts />} />

        {/* Authenticated dashboard */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Overview />} />
            <Route path="prompts" element={<Prompts />} />
            <Route path="prompts/new" element={<NewPrompt />} />
            <Route path="prompts/:id" element={<PromptDetail />} />
            <Route path="evaluations" element={<Evaluations />} />
            <Route path="evaluations/run" element={<RunEvaluation />} />
            <Route path="evaluations/runs/:id" element={<EvaluationResult />} />
            <Route path="executions" element={<Executions />} />
            <Route path="executions/:id" element={<ExecutionDetail />} />
            <Route path="comparisons" element={<Comparisons />} />
            <Route path="analytics"element={<Analytics />}/>
            <Route path="settings" element={<ComingSoon label="Settings" />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;