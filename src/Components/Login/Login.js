import "./Login.css";
import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Input from "../ui/Input/Input";
import Button from "../ui/Button/Button";
import { AUTH_STRINGS } from "../../i18n/strings";

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
          <h1>{AUTH_STRINGS.login_title}</h1>

          {accept && Error === "error" && (
            <p className="error">{AUTH_STRINGS.invalid_credentials}</p>
          )}

          <Input
            label={AUTH_STRINGS.username}
            name="username"
            placeholder={AUTH_STRINGS.username}
            icon="fa-solid fa-user"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Input
            label={AUTH_STRINGS.password}
            id="pass"
            type={show_password ? "text" : "password"}
            placeholder={AUTH_STRINGS.password}
            icon={show_password ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"}
            onIconClick={() => set_show_password((v) => !v)}
            iconLabel={show_password ? AUTH_STRINGS.hide_password : AUTH_STRINGS.show_password}
            required
            maxLength={20}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={accept && password.length < 5 ? AUTH_STRINGS.password_too_short : ""}
          />

          <Button type="submit" fullWidth loading={submitting}>
            {AUTH_STRINGS.submit_login}
          </Button>

          <div className="Link-to-Register">
            <p>
              {AUTH_STRINGS.no_account}
              <Link to={"/Register/Register.js"} className="links"> {AUTH_STRINGS.go_register}</Link>
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
