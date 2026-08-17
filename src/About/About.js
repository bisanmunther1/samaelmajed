import "./About.css";
import { Link } from "react-router-dom";

 export default function About() {
  function edit_style(className) {
 
    document.querySelector(`.${className}`).focus();
  
  }

  const  hotelClick =() => {
    document.getElementById("newHotel").style.display = 'flex';
    document.getElementById("newWhy").style.display = 'none';
    document.getElementById("newDest").style.display = 'none';

}
const  newhotelClick =() => {
  document.getElementById("newHotel").style.display = 'none';
}

function whyClick() {
    document.getElementById("newWhy").style.display = 'flex';
    document.getElementById("newHotel").style.display = 'none';
    document.getElementById("newDest").style.display = 'none';


}
const  newwhylClick =() => {
  document.getElementById("newWhy").style.display = 'none';
}
function destClick() {
    document.getElementById("newDest").style.display = 'flex';
    document.getElementById("newHotel").style.display = 'none';
    document.getElementById("newWhy").style.display = 'none';


}
const  newdestClick =() => {
  document.getElementById("newDest").style.display = 'none';
}

  return (
    <div id="about_root"> 
      <div id="firstAboutSection">
        <div id="text">
          <h1 id="join_us_word"  >Join Us</h1>
          <p >Enjoy With Our Comfortable Flights</p>
        </div>
      </div>
      <div id="AboutUsSection">
        
        <p className='text_edit'>
       <span  style={{fontWeight:'bold', fontSize:'35px', textShadow:'0px 0px 1px black',}}>Sama al Majd  is your best chosen...</span>
        <br></br>It provides Luxury travel, Adventure trips, Family vacations.
        <br></br>We are here to help you choose the best and most comfortable Trip
        <br></br>Decide your desination ,Booking a hotel and choose resturants.
        <br></br>where we weave the threads of adventure, history,
        <br></br>and storytelling into a tapestry of unforgettable experiences.
        <br></br>As passionate enthusiasts of exploration,
        <br></br>we are dedicated to curating exceptional journeys through our  pillars of expertise:
        <br></br>Historical Site Visits, and Natural Sites Visits.Led by experienced ,
        <br></br>immerse yourself in the beauty of nature.</p>
      </div>
      <div id="welcomVisitor">
        <h2 className="titleMS" >Welcome Our Visitor</h2>
        <p>Complete your hotel booking and resturant chosing and tick off your dreams destinations from your bukcet list
           <br></br> and like we always say "<span style={{fontStyle: 'italic'  ,}}>To Travel Is To Live</span>" so Travel with "Sama al Majd?"
        </p>
        <p >For eruditeness the services we offer<br></br>Go to the Home bage</p>
        <Link to={"/"} id="home_link_from_about" title="Home page" onClick={()=>edit_style("Header_Button-Home") } >
          <i className='fa-solid fa-house'  	 ></i>
        </Link>

      </div>
      <div>
        <h2 className="titleMS">Our Services</h2>
       
	   <div className="cards">
          <div id="hotelBooking" className="card" onClick={hotelClick} >
           <i class="fa-solid fa-hotel" ></i>
           <h3>Hotel Booking</h3>
           <p>Click to see our services about Hotel Booking</p>
             </div>
          <div id="destination" className="card" onClick={destClick}>
            <i class="fa fa-arrows"   ></i>
            <h3> Choose Destination</h3>
            <p>Click to see our services about help you chooce your desination aroun the World</p>
             
          </div>
          <div id="Why" className="card" onClick={whyClick}>
            <i className="fa-solid fa-plane-departure" style={{ fontSize: "40px", marginTop: "2%", borderRadius: 'var(--radius-md)', backgroundColor: "var(--color-secondary-dark)", color: "var(--color-surface)", padding: "10px" }}></i>
            <h3> Why Sama al Majd</h3>
            <p>Click to see our services make us the best travel website</p>
              </div>
        </div>
        <div id="newHotel">
          <div className="newText">
           
           <h3>Hotel Booking</h3>
           For Hotel,We have get you covered;we bring you the best hotel offers from over 1M hotels with the best reviews.
           Apart from this we also have a wide range of options in Chalets,which are the best in quality,luxurious yet affordable.
           On top of this,we have the best of offers and deals for your hotel bookings and stayactions plans.
         
         </div>
         <img src={require('./hotel1.jpg')} width="20%" alt="  "  ></img>
         <img src={require('./hotel2.png')} width='20%' alt="  " ></img>
         <i class='fas fa-angle-up' style={{fontSize:'30px' , cursor:'pointer' }} onClick={newhotelClick}></i>

        </div>
        <div id="newDest">
          <div className="newText">
           <h3>Choose Destination</h3>
           At Sama al Majd we help you choose yor destination ,We Exposes the most wonderful plasec aroun World,
           If wou want to visits a Historical Sites,Enjoy the Picturesqe Nature,go to beach 
           and enjoy whith sea and its waves and staying in comfortable chalets,Experience an advanture
           on the slopes of the mountains .
         </div>
         <img src={require('./dest1.jpg')} width="20%" alt="  "></img>
         <img src={require('./dest2.png')} width="20%" alt="  "></img>
         <i class='fas fa-angle-up' style={{fontSize:'30px' , cursor:'pointer' }} onClick={newdestClick}></i>

         </div>
         <div id="newWhy">
          <div className="newText">
           <h3>Why Sama al Majd</h3>
           <ul><li>choose from over 1M around the global</li>
             <li>Exclusive flight deals</li>
             <li>Provides realistic images of sites</li> 
             <li>Provides the best offers at competitive prices</li></ul>
         </div>
         <img src={require('./why1.jpg')} width="20%" alt=" "></img>
         <img src={require('./why2.jpg')} width="20%" alt="  "></img>
         <i class='fas fa-angle-up' style={{fontSize:'30px' , cursor:'pointer' }} onClick={newwhylClick}></i>

         </div>
      </div>
      <div id="lastAboutSection" >
        <div id="NoteAboutSS">
          <p>READ WHAT<br></br>OUR RECENT<br></br>CLIENTS SAY</p>
        </div>
        <div class="comment">
      <p style={{padding:'0 20px'}}>
          <span class="userComment"><i class="fa fa-user-circle" aria-hidden="true" ></i><br></br>
          <span id="userName">Joen Rafi</span></span>
          <br></br>
          <i class="fa fa-quote-left" aria-hidden="true"></i><span>  </span>
          is a nice trip with your website we have stayed in a comfortable hotel with distinctive<span>  </span>
          <i class="fa fa-quote-right" aria-hidden="true"></i>
          </p>
        </div>
        <div class="comment" style={{marginRight:"10%" ,padding:'0 20px'}} >
          <p>
          <span class="userComment"><i class="fa fa-user-circle" aria-hidden="true" ></i><br></br>
          <span id="userName">Ahmed Refai</span></span>
          <br></br>
          <i class="fa fa-quote-left" aria-hidden="true"></i><span>  </span>
          I Like Your Website ,help me choose the most suitble hotel and resturant with delicious food <span>  </span>
          <i class="fa fa-quote-right" aria-hidden="true"></i>
          </p>
        </div>
      </div>
    </div>
    
  );
   

}
