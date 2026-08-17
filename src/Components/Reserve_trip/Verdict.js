
export default function Verdict( props) {
	
	let now = props.verdict;
	
	if( now === "accepted" )
	{
		let style={
			 width:'40%',
			 position:'absolute',
			 padding:'20px',
			 textAlign:'center',
			 borderRadius:'20px',
			 fontSize:'30px',
			 backgroundColor:'#7cff7c',
		}
		
		 return <> 
            
         <div style ={style}>  well done!  </div>			
          
		 </>
		
	}	
	  else if( now =="error") 
	  {
		  	let style={
			 width:'40%',
			 position:'absolute',
			 padding:'20px',
			 textAlign:'center',
			 borderRadius:'20px',
			 fontSize:'30px',
			 backgroundColor:'#ff5f5f',
		}
		
		 return <> 
            
         <div style ={style}>  there was an error!  </div>			
          
		 </>
	  }
	  
	  else 
	  {
		   return <></>
		  
	  }
	
}