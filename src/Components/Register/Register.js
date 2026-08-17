import "./Register.css";
import "../../all.min.css";
import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import Input from "../ui/Input/Input";
import Button from "../ui/Button/Button";
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
          <h2>SignUp</h2>

          <Input
            label="Username"
            placeholder="Username"
            name="username"
            icon="fa-solid fa-user"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={accept && (existence.length > 1 || existence[0] === 'name') ? "Name is already taken" : ""}
          />

          <Input
            label="Email"
            type="email"
            placeholder="Email"
            name="email"
            icon="fa-solid fa-envelope"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={accept && (existence.length > 1 || existence[0] === 'email') ? "Email is already taken" : ""}
          />

          <Input
            label="Password"
            type={show_password ? "text" : "password"}
            placeholder="Password"
            name="password"
            icon={show_password ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"}
            onIconClick={() => set_show_password((v) => !v)}
            iconLabel={show_password ? "Hide password" : "Show password"}
            required
            minLength={5}
            maxLength={20}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={accept && password.length < 5 ? "Password must be more than 4 characters" : ""}
          />

          <Input
            label="Confirm password"
            type={show_password ? "text" : "password"}
            placeholder="Confirm Password"
            name="confirm pass"
            icon="fa-solid fa-lock"
            required
            minLength={5}
            maxLength={20}
            value={passwordR}
            onChange={(e) => setPasswordR(e.target.value)}
            error={accept && passwordR !== password ? "Password does not match" : ""}
          />

          <div className="Buttons">
            <Button type="submit" fullWidth loading={submitting}>Register</Button>
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
