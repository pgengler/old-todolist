function AJAX(url, callback, timeout_int, timeout_func, param)
{
	var timeout = null;
	var xmlHttpReq = null;

	if (window.XMLHttpRequest) { // sane browsers
		xmlHttpReq = new XMLHttpRequest();
	} else if (window.ActiveXObject) { // IE <= 6
		xmlHttpReq = new ActiveXObject("Microsoft.XMLHTTP");
	}

	// make an AJAX request for the current info
	if (callback) {
		xmlHttpReq.onreadystatechange = function()
		{
			if (xmlHttpReq.readyState == 4) {
				clearTimeout(timeout);
				callback(xmlHttpReq.responseXML);
			}
		}
	}

	xmlHttpReq.open('POST', url, true);
	xmlHttpReq.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

	var a = this;

	if (timeout_int && timeout_int != 0 && timeout_func != null) {
		timeout = setTimeout(function() { timeout_func(a, param); }, timeout_int);
	} else if (timeout_int && timeout_int != 0) {
		timeout = setTimeout(function() { a.timeout(); }, timeout_int);
	}

	this.timeout = function()
	{
		xmlHttpReq.onreadystatechange = null;
		xmlHttpReq.abort();
	}

	this.send = function(paramstr)
	{
		xmlHttpReq.send(paramstr);
	}

	this.abort = function()
	{
		xmlHttpReq.onreadystatechange = null;
		xmlHttpReq.abort();
	}
}
