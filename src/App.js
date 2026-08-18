/* eslint-disable react/jsx-pascal-case */
import { Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";
 
import Login from "./Components/Login/Login";
 
import Register from "./Components/Register/Register";
 
import Home from "./Home/Home";
 
import Header from "./Components/Header/Header";

import Profile from "./Components/Profile/Profile";

import Profile_edit_info from "./Components/Profile/Profile_edit_info/Profile_edit_info";

import Footer from "./Components/Footer/Footer";

import About from './About/About';

import { ToastProvider } from "./Components/ui/Toast/ToastContext";
import { BookingProvider } from "./Components/Reserve_trip/BookingContext";
import Reserve_trip from "./Components/Reserve_trip/Reserve_trip";

import Partner from "./Components/Partner/Partner";

import "./all.min.css";

export default function App() {

	// Most copy is read through the strings modules rather than a hook, so a
	// language switch is made visible by remounting the tree under a new key.
	// Switching is rare and deliberate, so the cost is not felt.
	const { i18n } = useTranslation();

	return (
		<ToastProvider key={i18n.language}>
		<BookingProvider>

      <Header/>
		  <Routes>
				<Route path="/" element={<Home />}   />
				<Route path="/Register/Register.js" element={<Register />} />
				<Route path="/Login/Login.js" element={<Login />} />
				<Route path="/About/About.js" element={<About />}  />
				<Route path="/Profile/Profile.js" element={<Profile />} />
				<Route path="/Profile/Profile_edit_info/Profile_edit_info.js" element={<Profile_edit_info />} />
				<Route path="/Partner/Partner.js" element={<Partner />} />
		  </Routes>
			<Footer />
			<Reserve_trip />

	  </BookingProvider>
	  </ToastProvider>
	);


}
