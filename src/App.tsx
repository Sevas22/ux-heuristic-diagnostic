import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Landing from "@/pages/Landing";
import IntakeForm from "@/pages/IntakeForm";
import ReportStatus from "@/pages/ReportStatus";
import NotFound from "@/pages/NotFound";

function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/formulario" element={<IntakeForm />} />
        <Route path="/informe/:accessToken" element={<ReportStatus />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
