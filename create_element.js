function create_element(elem)
{
	if (elem.element == 'text')
		return document.createTextNode(elem.text);

	var dom_element = document.createElement(elem.element);

	/* Properties we should expect:
   *   NAME         TYPE      APPLIES TO
   *-----------------------------------
	 *   id           string    [*]
	 *   class        string    [*]
   *   href         string    [a]
   *   src          string    [img]
   *   value        string    [input, option]
   *   type         string    [input]
	 *   style        string    [*]
   *   selected     bool      [option]
   *   checked      bool      [input]

	 *   colspan      int       [td]
	 *   rowspan      int       [td]

	 *   onchange     string    [select]
   *   onclick      string    [*]
	 *   onsubmit     string    [form]
	 *   onmouseover  string    [*]
	 *   onmouseout   string    [*]
   */

	if (elem.id)
		dom_element.setAttribute('id', elem.id);
	if (elem.class)
		dom_element.setAttribute('class', elem.class);
	if (elem.href)
		dom_element.setAttribute('href', elem.href);
	if (elem.src)
		dom_element.setAttribute('src', elem.src);
	if (typeof(elem.value) != 'undefined')
		dom_element.setAttribute('value', elem.value);
	if (elem.type)
		dom_element.setAttribute('type', elem.type);
	if (elem.style)
		dom_element.setAttribute('style', elem.style);
	if (elem.selected)
		dom_element.setAttribute('selected', 'selected');
	if (elem.checked)
		dom_element.setAttribute('checked', 'checked');

	if (elem.colspan)
		dom_element.setAttribute('colspan', elem.colspan);
	if (elem.rowspan)
		dom_element.setAttribute('rowspan', elem.rowspan);

	if (elem.onchange)
		if (typeof(elem.onchange) == 'function')
			dom_element.onchange = elem.onchange;
		else
			dom_element.setAttribute('onchange', elem.onchange);
	if (elem.onclick)
		if (typeof(elem.onclick) == 'function')
			dom_element.onclick = elem.onclick;
		else
			dom_element.setAttribute('onclick', elem.onclick);
	if (elem.onsubmit)
		if (typeof(elem.onsubmit) == 'function')
			dom_element.onsubmit = elem.onsubmit;
		else
			dom_element.setAttribute('onsubmit', elem.onsubmit);
	if (elem.onmouseover)
		if (typeof(elem.onmouseover) == 'function')
			dom_element.onmouseover = elem.onmouseover;
		else
			dom_element.setAttribute('onmouseover', elem.onmouseover);
	if (elem.onmouseout)
		if (typeof(elem.onmouseout) == 'function')
			dom_element.onmouseout = elem.onmouseout;
		else
			dom_element.setAttribute('onmouseout', elem.onmouseout);

	if (elem.text)
		dom_element.appendChild(document.createTextNode(elem.text));

	if (elem.children)
		for (var i = 0; i < elem.children.length; i++)
			dom_element.appendChild(create_element(elem.children[i]));

	return dom_element;
}
