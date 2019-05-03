$("#btn").on("click", function(e){
    alert("hoooo000");
    const url = $('#b').html();
    const token = $('#a').html();
    const shop = $('#c').html();
    console.log(url);

    $.ajax({
        url: "https://315cdb30.ngrok.io/settings",
        data: { disable_right_click_text: true, disable_cut_copy: false },
        headers: {token, shop},
        
        type: "GET",
        success: function(data) { console.log('Success! ' + data); },
        error: function(error) { console.log('Failure! ' + error); }
     });
   
});