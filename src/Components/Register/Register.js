import "./Register.css";
import "../../all.min.css";
import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import Input from "../ui/Input/Input";
import Button from "../ui/Button/Button";
import { AUTH_STRINGS } from "../../i18n/strings";
import { useToast } from "../ui/Toast/ToastContext";

export default function Register() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordR, setPasswordR] = useState("");
  const [show_password, set_show_password] = useState(false);
  const [accept, setAccept] = useState(false);
  const [existence, set_existence] = useState([]); // email or(and) name already exist(s)
  const [submitting, set_submitting] = useState(false);

  async function Submit(e) {
    e.preventDefault();
    setAccept(true);

    if (name === "" || password.length < 5 || password !== passwordR) return;

    let url = 'http://127.0.0.1:8000/user/add/';

    let user = {
      username: name,
      email: email,
      password: password,
    }

    set_submitting(true);
    try {
      await axios.post(url, user);
      showToast('Registration complete! Log in with your new account.', 'success');
      navigate('/Login/Login.js');
    } catch (err) {
      if (err.response && err.response.data !== null)
        set_existence(err.response.data);
    } finally {
      set_submitting(false);
    }
  }

  return (
    <>

      <div className="Register-page">

      <div className="form-box">
        <form onSubmit={Submit}>
          <h2>{AUTH_STRINGS.submit_register}</h2>

          <Input
            label={AUTH_STRINGS.username}
            placeholder={AUTH_STRINGS.username}
            name="username"
            icon="fa-solid fa-user"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={accept && (existence.length > 1 || existence[0] === 'name') ? AUTH_STRINGS.username_taken : ""}
          />

          <Input
            label={AUTH_STRINGS.email}
            type="email"
            placeholder={AUTH_STRINGS.email}
            name="email"
            icon="fa-solid fa-envelope"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={accept && (existence.length > 1 || existence[0] === 'email') ? AUTH_STRINGS.email_taken : ""}
          />

          <Input
            label={AUTH_STRINGS.password}
            type={show_password ? "text" : "password"}
            placeholder={AUTH_STRINGS.password}
            name="password"
            icon={show_password ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"}
            onIconClick={() => set_show_password((v) => !v)}
            iconLabel={show_password ? AUTH_STRINGS.hide_password : AUTH_STRINGS.show_password}
            required
            minLength={5}
            maxLength={20}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={accept && password.length < 5 ? AUTH_STRINGS.password_too_short : ""}
          />

          <Input
            label={AUTH_STRINGS.confirm_password}
            type={show_password ? "text" : "password"}
            placeholder={AUTH_STRINGS.confirm_password}
            name="confirm pass"
            icon="fa-solid fa-lock"
            required
            minLength={5}
            maxLength={20}
            value={passwordR}
            onChange={(e) => setPasswordR(e.target.value)}
            error={accept && passwordR !== password ? AUTH_STRINGS.passwords_do_not_match : ""}
          />

          <div className="Buttons">
            <Button type="submit" fullWidth loading={submitting}>{AUTH_STRINGS.register_title}</Button>
            <p>
              Do you already have an account?
              <Link className="BLogin" to={"/Login/Login.js"}>
                Login
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>

 </>   );
}
