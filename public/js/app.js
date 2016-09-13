$(document).foundation()

$("#Productwise").addClass("secondary");
$("#Productwise").click(function(){
	$("#Productwise").removeClass("secondary");
	$("#Outletwise").addClass("secondary");
});
$("#Outletwise").click(function(){
	$("#Outletwise").removeClass("secondary");
	$("#Productwise").addClass("secondary");
});
