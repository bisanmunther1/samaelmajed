import "./Footer.css";
import "../../all.min.css"
import { Link } from "react-router-dom";
export default function Footer() {

  function edit_style(className) {
 
    document.querySelector(`.${className}`).focus();
  
  }
  return (
    <>
    <div id="Footer_root_element">
       
     <div id="first_part_of_footer">
          
       <div id="footer_section1">
          
         <Link to={"/"} id="footer_site-photo" title="Home page">Sama al Majd</Link>

          <div id="descFooterSection1">
            travel and discover the world with our website.
          </div>
          
        </div>{/* end of section1 , the photo and some text */}

        <div id="footer_section2">
           
          <span style={{ fontWeight: "bold", fontSize: "25px" }}>
              important links :</span>
            
			    <Link to={"/"} id="home_link_footer" title="Home page" onClick={()=>edit_style("Header_Button-Home") } >
                 <i className="fa-solid fa-house"> </i> Home  </Link>

            
			    <Link to={"/About/About.js"} id="about_link_footer" title="About us" onClick={()=>edit_style("Header_Button-About") }>
                 <i className="fa-solid fa-address-card"> </i>   About us </Link>
			
        </div> {/*end of section 2 , links of site section */}

        <div id="footer_section3">
            
            <span style={{ fontWeight: "bold", fontSize: "25px" }}>
              connect us :
            </span>

            <div id="footer_connectNumber" title="call us">
              <i className="fa-solid fa-phone"></i>+963938469453
            </div>

            <a
              title="mail us"
              id="footer_googleMail"
              href="mailto:WhereToGo@gmail.com">
              <i className="fa-brands fa-google"></i>
              Sama al Majd.Work@gmail.com
            </a>

        </div>{/*end of section 3 , connect us section*/}

          <div id="footer_section4">

            <span style={{ fontWeight: "bold", fontSize: "25px" }}>
               Support us
                <span
                  style={{
                    fontSize: "20px",
                    paddingLeft: "5px",
                    paddingBottom: "15px",
                    color: "red",
                  }}
                  className="fa-solid fa-heart"></span> :
            </span>

            <div id="footer_Section4Icons">

              <a href="https:facebook.com">
                <i className="fa-brands fa-facebook" title="facebook"></i>
              </a>

              <a href="https:instagram.com" style={{ color: "#b6149c" }}>
                <i className="fa-brands fa-instagram" title="instagram"></i>
              </a>

              <br />

              <a href="https:X.com" style={{color:"black"}}>
                <i className="fa-brands fa-x-twitter" title="x-twitter"></i>
              </a>

              <a href="https:linkedin.com">
                <i className="fa-brands fa-linkedin" title="linkedin"></i>
              </a>

        
 
            </div>{/*end of icons of section 4 */}

          </div> {/*end of section 4 , support us section*/ }

        </div> {/*end of the first part of the photer , the footer itself */}

        <div id="second_part_of_footer">
           Sama al Majd	 2024 &#169; all rights reserved
        </div>
      
      </div>
    </>
  );
 
 
}
