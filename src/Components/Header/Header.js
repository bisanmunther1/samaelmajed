import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import "./Header.css";

import axios from "axios";
import Button from "../ui/Button/Button";
import { fetch_partner_me, is_logged_in } from "../Partner/partnerApi";
import { PARTNER_STRINGS } from "../Partner/strings";
import { COMMON_STRINGS } from "../../i18n/common";
import { current_language, set_language } from "../../i18n";

export default function Header() {

  let curr_name = localStorage.getItem('username');

  const [menuOpen, setMenuOpen] = useState(false);

  // Whether to show the partner link is the server's answer, not a claim read
  // out of localStorage. A customer who edits storage still gets nothing here,
  // and every partner endpoint would reject them anyway.
  const [is_partner, set_is_partner] = useState(false);

  useEffect(() => {
    if (!is_logged_in()) return undefined;

    let cancelled = false;

    fetch_partner_me()
      .then((partner) => {
        if (cancelled) return;
        set_is_partner(Boolean(partner && partner.is_approved));
      })
      .catch(() => {
        // Not a partner, or the check failed — either way, no link.
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  const language = current_language();
  const next_language = language === "ar" ? "en" : "ar";

  // One toggle rather than two options: with exactly two languages, showing the
  // one you would switch *to* is both shorter and unambiguous.
  function language_button(onPick) {
    return (
      <button
        type="button"
        className="Header_Button-About Header_language-toggle"
        lang={next_language}
        aria-label={COMMON_STRINGS.language}
        onClick={() => {
          if (onPick) onPick();
          set_language(next_language);
        }}
      >
        <i className="fa-solid fa-globe" aria-hidden="true"></i>
        {next_language === "ar" ? COMMON_STRINGS.language_arabic : COMMON_STRINGS.language_english}
      </button>
    );
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

            {is_partner && (
              <Link to={"/Partner/Partner.js"} className="Header_Button-About">
                {PARTNER_STRINGS.nav_link}
              </Link>
            )}

            {language_button()}
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
          {is_partner && (
            <Link to={"/Partner/Partner.js"} className="Header_Button-About" onClick={closeMenu}>
              {PARTNER_STRINGS.nav_link}
            </Link>
          )}
          {language_button(closeMenu)}
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
