
import React , {useRef , useEffect } from 'react';

export default function Paypal(props){
 
const paypal =useRef();	 
 	
	try {
		useEffect( () =>
			{
				window.paypal.Buttons({ 
				 createOrder:( data, actions, err) =>{
					 return actions.order.create({
						 intent:"CAPTURE" ,
						 purchase_units:[
						  {
							description:"trip",
							amount:{
							  currency_code:"USD",
							  value:parseInt(props.total_price)
							}
						  }
						 ]
					 })
				 },
				 onApprove: async(data , actions) =>
				 {
					//  const order = await actions.order.capture();
					  console.log("successful order :");

				 },
				 onError:( err) =>
					 {
					   console.log("there was an error :");
					   console.log(err); 
				
					 } 
					 
				 } 
				
				 ).render(paypal.current)
			}
			, [props.total_price] )
		
	} 
	catch (e)
	{
		console.log('falid to pay')
	}
	

	return (
	  <>
	  
	  <div id="paypal_root" ref ={paypal}></div>
	 
	 
	 </>
	);
}