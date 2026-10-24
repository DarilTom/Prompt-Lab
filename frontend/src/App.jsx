import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AdminRoute from "./components/auth/AdminRoute";
import PromptDetail from "./pages/dashboard/PromptDetail";
import AdminDashboard from "./pages/dashboard/AdminDashboard";
import AdminUsers from "./pages/dashboard/AdminUsers";


// Dashboard shell + pages
import DashboardLayout from "./components/dashboard/DashboardLayout";
import Overview from "./pages/dashboard/Overview";
import Prompts from "./pages/dashboard/Prompts";
import NewPrompt from "./pages/dashboard/NewPrompt";
import PromptImprover from "./pages/dashboard/PromptImprover";
import Executions from "./pages/dashboard/Executions";
import ExecutionDetail from "./pages/dashboard/ExecutionDetail";
import Comparisons from "./pages/dashboard/Comparisons";
import Analytics from "./pages/dashboard/Analytics";
import Evaluations from "./pages/dashboard/Evaluations";
import RunEvaluation from "./pages/dashboard/RunEvaluation";
import EvaluationResult from "./pages/dashboard/EvaluationResult";
import EvaluationCompare from "./pages/dashboard/EvaluationCompare";
import RepeatEvaluation from "./pages/dashboard/RepeatEvaluation";
import VersionPerformanceAnalysis from "./pages/dashboard/VersionPerformanceAnalysis";
import Settings from "./pages/dashboard/Settings";




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
            <Route index element={<PromptImprover />} />
            <Route path="overview" element={<Overview />} />
            <Route path="prompts" element={<Prompts />} />
            <Route path="prompts/new" element={<NewPrompt />} />
            <Route path="prompts/improve" element={<PromptImprover />} />
            <Route path="prompts/:id" element={<PromptDetail />} />
            <Route path="evaluations" element={<Evaluations />} />
            <Route path="evaluations/run" element={<RunEvaluation />} />
            <Route path="evaluations/runs/:id" element={<EvaluationResult />} />
            <Route path= "evaluations/compare"element={<EvaluationCompare />} />
            <Route path= "evaluations/repeat" element={<RepeatEvaluation />} /> 
            <Route path="evaluations/performance"element={<VersionPerformanceAnalysis />}/>
            <Route path="executions" element={<Executions />} />
            <Route path="executions/:id" element={<ExecutionDetail />} />
            <Route path="comparisons" element={<Comparisons />} />
            <Route path="analytics"element={<Analytics />}/>
            <Route path="settings" element={<Settings />} />

            {/* Admin only */}
            <Route element={<AdminRoute />}>
              <Route path="admin" element={<AdminDashboard />} />
              <Route path="admin/users" element={<AdminUsers />} />
            </Route>
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;