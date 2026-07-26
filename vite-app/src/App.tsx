import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";

export default function App() {
  return (
    <BrowserRouter>
      <ServiceWorkerRegister />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  );
}
