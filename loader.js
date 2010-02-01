$(document).ready(init);

var _hash = location.hash;

if (window.addEventListener)
	window.addEventListener('hashchange', do_load, false);
else if (window.attachEvent)
	window.attachEvent('onhashchange', do_load);

if (!('onhashchange' in window))
	setInterval(check_hashchange, 125);

var view_date = null;

function init()
{
	var date = null;

	// Do we have a date?
	if (location.hash && location.hash != '') {
		var parts;
		if ((parts = location.hash.match(/#(\d{4})(\d{2})(\d{2})/))) {
			view_date = new Date(parts[1], parts[2] - 1, parts[3]);
			date = view_date.strftime('%Y-%m-%d');
		} else if (location.hash == '#template')
			date = 'template';
	} else {
		view_date = new Date();
		view_date.setHours(0); view_date.setMinutes(0); view_date.setSeconds(0);
	}

	// Make AJAX request
	var ajax = new AJAX(base_url, process);

	ajax.send({
		action: 'load',
		view: date || ''
	});
}

function check_hashchange()
{
	if (_hash != location.hash) {
		_hash = location.hash;
		do_load();
	}
}

function load(date)
{
	if (window.onhashchange)
		return true;

	if (typeof(date) == 'object')
		location.hash = '#' + date.strftime('%Y%m%d');
	else
		location.hash = '#' + date;

	do_load();

	return false;
}

function do_load()
{
	var date = location.hash.substring(1);

	var parts;
	if (date && (parts = date.match(/(\d{4})(\d{2})(\d{2})/))) {
		date = parts[1] + '-' + parts[2] + '-' + parts[3];
		view_date = new Date(parts[1], parts[2] - 1, parts[3]);
	}

	// Show 'processing...' text and spinner
	var table = document.getElementById('content').getElementsByTagName('tbody')[0];
	remove_all_children(table);

	table.appendChild(create_element({
		element: 'tr', children: [
			{
				element: 'td', colspan: 6, cssclass: 'loading', children: [
					{
						element: 'img', src: index_url + 'images/loading.gif'
					},
					{
						element: 'text', text: 'Loading ...'
					}
				]
			}
		]
	}));

	var ajax = new AJAX(base_url, process);

	ajax.send({
		action: 'load',
		view: date || ''
	});
}

function process(response)
{
	var root = response.getElementsByTagName('todo')[0];

	// Cancel any edits/menus
	clear_edits();
	hide_tags_menu();

	template = parseInt(root.getAttribute('template'));

	// Load tag data
	load_tags(root.getElementsByTagName('tags')[0]);

	// Load item data
	load_items(root.getElementsByTagName('items')[0]);

	populate();

	// Update previous week/next week links, if necessary
	if (!template && (!rolling || get_view().view != null))
		update_links();
}

function load_tags(xml)
{
	var list = xml.getElementsByTagName('tag');
	var len  = list.length;

	delete tags;
	tags = new Tags();

	for (var i = 0; i < len; i++) {
		tags.add(new Tag(list[i]));
	}
}

function load_items(xml)
{
	delete items;
	items = new Items();

	var things = xml.getElementsByTagName('item');

	var len = things.length;
	for (var i = 0; i < len; i++)
		items.add(new Item(things[i]));
}

