import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Input from "../Components/ui/Input/Input";
import Button from "../Components/ui/Button/Button";
import Card from "../Components/ui/Card/Card";
import { useAdminAuth } from "./AdminAuthContext";
import "./Admin.css";

export default function AdminLogin() {
  const { login, auth_status } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, set_username] = useState("");
  const [password, set_password] = useState("");
  const [error, set_error] = useState("");

  async function handle_submit(e) {
    e.preventDefault();
    set_error("");

    try {
      const claims = await login(username, password);
      if (!claims || !claims.is_staff) {
        set_error("This account doesn't have admin access.");
        return;
      }
      const redirect_to = location.state?.from?.pathname || "/admin";
      navigate(redirect_to, { replace: true });
    } catch (e) {
      set_error("Invalid username or password.");
    }
  }

  return (
    <div id="admin_login_page">
      <Card className="admin_login_card">
        <h1>سما المجد Admin</h1>
        <p className="admin_login_subtitle">Staff sign in</p>

        <form onSubmit={handle_submit}>
          {error && <p className="admin_login_error">{error}</p>}

          <Input
            label="Username"
            icon="fa-solid fa-user"
            required
            value={username}
            onChange={(e) => set_username(e.target.value)}
          />

          <Input
            label="Password"
            type="password"
            icon="fa-solid fa-lock"
            required
            value={password}
            onChange={(e) => set_password(e.target.value)}
          />

          <Button type="submit" fullWidth loading={auth_status === "loading"}>
            Sign in
          </Button>
        </form>
      </Card>
    </div>
  );
}
