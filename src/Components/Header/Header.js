import { Link } from "react-router-dom";
import { useState } from "react";
import "./Header.css";

import axios from "axios";
import Button from "../ui/Button/Button";

export default function Header() {

  let curr_name = localStorage.getItem('username');

  const [menuOpen, setMenuOpen] = useState(false);

  let Update = async () => {

     let url = 'http://localhost:8000/token/refresh/';

     try {

       let res = await axios.post(url, JSON.stringify({ 'refresh': localStorage.getItem('refresh_token') }),
         {
           headers: {
             'Content-Type': 'application/json',
            }
          });

       console.log('yes updated');

       let tem = res.data['access'];
       let tem2 = res.data['refresh'];

       localStorage.setItem('access_token', tem);
       localStorage.setItem('refresh_token', tem2);
     }
     catch (e) {
       console.log('error in update', e);
     }
  }



  let logOut = async () => {

     await Update();


   let url = 'http://localhost:8000/user/logout/';


    axios.post(url,{'refresh_token': localStorage.getItem('refresh_token'), },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
         }
      },
       )
      .then(() => {
        localStorage.clear();
        window.location.href = '/';
       })
      .catch(err => { console.log('log out error'); });
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="Header_Header">
      <div className="Header_bar">
        <div className="Header_Home-About">
          <Link to={"/"} className="Header_site-image" title="Home page" aria-label="Home page" onClick={closeMenu}>Sama al Majd</Link>
          <nav className="Header_desktop-nav" aria-label="Primary">
            <Link to={"/"} className="Header_Button-Home">
              Home
            </Link>

            <Link to={"/About/About.js"} className="Header_Button-About">
              About
            </Link>
          </nav>
        </div>

        <div className="Header_Login-Register Header_desktop-nav">
          {curr_name === null ? (
            <>
              <Link to={"/Register/Register.js"} className="Header_Button-Register">
                Register
              </Link>
              <Link to={"/Login/Login.js"} className="Header_Button-Login">
                Login
              </Link>
            </>
          ) : (
            <>
              <Link className="Header_Button-Logout" to={"/Profile/Profile.js"}> {curr_name}</Link>
              <Button variant="ghost" size="sm" onClick={logOut}>
                Log out
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="Header_mobile-toggle"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <i className={menuOpen ? "fa-solid fa-xmark" : "fa-solid fa-bars"} aria-hidden="true"></i>
        </button>
      </div>

      {menuOpen && (
        <nav className="Header_mobile-menu" aria-label="Primary">
          <Link to={"/"} className="Header_Button-Home" onClick={closeMenu}>
            Home
          </Link>
          <Link to={"/About/About.js"} className="Header_Button-About" onClick={closeMenu}>
            About
          </Link>
          {curr_name === null ? (
            <>
              <Link to={"/Register/Register.js"} className="Header_Button-Register" onClick={closeMenu}>
                Register
              </Link>
              <Link to={"/Login/Login.js"} className="Header_Button-Login" onClick={closeMenu}>
                Login
              </Link>
            </>
          ) : (
            <>
              <Link className="Header_Button-Logout" to={"/Profile/Profile.js"} onClick={closeMenu}> {curr_name}</Link>
              <Button variant="ghost" size="sm" onClick={() => { closeMenu(); logOut(); }}>
                Log out
              </Button>
            </>
          )}
        </nav>
      )}
    </header>
    );
}
