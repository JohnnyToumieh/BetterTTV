function betterttv_init()
{
	script = document.createElement('script');
	script.type = 'text/javascript';
	script.src = "http://127.0.0.1:2888/betterttv.js";
	thehead = document.getElementsByTagName('head')[0];
	if(thehead) thehead.appendChild(script);
}

betterttv_init();