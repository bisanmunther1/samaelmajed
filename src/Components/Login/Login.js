import "./Login.css";
import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Input from "../ui/Input/Input";
import Button from "../ui/Button/Button";

export default function Login() {

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [show_password, set_show_password] = useState(false);
  const [accept, setAccept] = useState(false);
  const [Error, set_Error] = useState("valid");
  const [submitting, set_submitting] = useState(false);

  function Submit(e) {
    e.preventDefault();
    setAccept(true);

    if (password.length < 5) return;

    const user = {
      'username': name,
      'password': password,
    };

    let url = 'http://localhost:8000/token/';

    set_submitting(true);
    axios.post(url, user)
      .then(response => {

        const d = response.data.access;
        const d2 = response.data.refresh;
        localStorage.setItem('access_token', d);
        localStorage.setItem('refresh_token', d2);
        localStorage.setItem('username', name);
        window.location.pathname = '/';
      }).catch(error => {
        set_submitting(false);
        set_Error("error");
        hide_error_after_time();
      })

  }

  return (
    <div className="login">
      <div className="wrapper">
        <form onSubmit={Submit}>
          <h1>Log in</h1>

          {accept && Error === "error" && (
            <p className="error">invalid user name or password</p>
          )}

          <Input
            label="Username"
            name="username"
            placeholder="Username"
            icon="fa-solid fa-user"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Input
            label="Password"
            id="pass"
            type={show_password ? "text" : "password"}
            placeholder="Password"
            icon={show_password ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"}
            onIconClick={() => set_show_password((v) => !v)}
            iconLabel={show_password ? "Hide password" : "Show password"}
            required
            maxLength={20}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={accept && password.length < 5 ? "Password must be more than 4 characters" : ""}
          />

          <Button type="submit" fullWidth loading={submitting}>
            Login
          </Button>

          <div className="Link-to-Register">
            <p>
              Don't have an account ?
              <Link to={"/Register/Register.js"} className="links"> Register</Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );

  function hide_error_after_time() {
    setTimeout(() => {
      set_Error('valid');
    }, 4000);
  }
}
