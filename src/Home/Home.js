/* eslint-disable react/jsx-pascal-case */
import "./Home.css";
import Gallery from "../Components/Gallery/Gallery";
 
import Trending_places from "../Components/Trending_places/Trending_places";
import Discount_places from "../Components/Discount_places/Discount_places";

export default function Home()
{
 
  // localStorage.clear();
 
  return (
   <>
 
     <div id="home_root" onPlay={init} onLoad    >
 
        <video  loop autoPlay muted>
          <source  src={require(`./1.mp4`)}/>
      </video>
      
        <div id="img_and_title_container">
          <div className="home_img_site" >سما المجد</div>
          <div className="home_title_site">
            All the world on one site </div>
        </div>
        </div>
      
    
       
      <Trending_places />
      
     <Discount_places /> 
 
      <Gallery />

   </>
  );
 
  function init()
  {
 
  let d = document.getElementById(`home_root`);
 
  if( d !== undefined  && d!== null)
    d.addEventListener("mousemove", (event) => {
    let x = event.x;
     
      let wid = document.getElementById('img_and_title_container').offsetWidth;
 
    let val2 = 2;
    if (x <= wid) {
      val2 *= -1;
    }
    
    document.getElementById(`img_and_title_container`).style.transform = `perspective(200px) rotateY(${val2}deg) translateX(${-val2*20}px)   `;
   
  }); 
 
   
  
  }
 
}