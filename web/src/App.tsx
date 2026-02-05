import { Link, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Staff from "./pages/Staff";
import QrScan from "./pages/QrScan";

export default function App() {
  return (
    <div style={{ fontFamily: "system-ui" }}>
      <nav style={{ padding: 12, borderBottom: "1px solid #eee", display: "flex", gap: 12 }}>
        <Link to="/">Home</Link>
        <Link to="/staff">Staff</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/staff" element={<Staff />} />
        <Route path="/q/:token" element={<QrScan />} />
      </Routes>
    </div>
  );
}
