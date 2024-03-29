$(document).ready(init);

var _hash = location.hash;

if (window.addEventListener)
	window.addEventListener('hashchange', do_load, false);
else if (window.attachEvent)
	window.attachEvent('onhashchange', do_load);

if (!('onhashchange' in window))
	setInterval(check_hashchange, 125);

var view_date = null;
var last_timestamp = 0;

function init()
{
	var date = null;

	$('body').on('click', '.new-item', new_item_form);

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

	// Make Ajax request
	var params = {
		action: 'load',
		view:   date || '',
	};
	var $request = $.get(base_url, params).done(process);
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

	// Hide datepicker
	if (picker) {
		picker.hide();
		delete picker;
	}

	var parts;
	if (date && (parts = date.match(/(\d{4})(\d{2})(\d{2})/))) {
		date = parts[1] + '-' + parts[2] + '-' + parts[3];
		view_date = new Date(parts[1], parts[2] - 1, parts[3]);
	}

	// Show 'processing...' text and spinner
	var table = document.getElementById('content').getElementsByTagName('tbody')[0];
	remove_all_children(table);

	table.appendChild(create_element({
		element: 'tr', id: 'loading', children: [
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

	var params = {
		action: 'load',
		view:   date || ''
	};
	var $request = $.get(base_url, params).done(process);
}

function process(response)
{
	// Cancel any edits/menus
	clear_edits();
	hide_tags_menu();

	template       = response.template;
	last_timestamp = parseInt(response.timestamp, 10);
	var full       = response.full;

	// Load tag data
	load_tags(response.tags);

	// Load item data
	load_items(response.items, full);

	populate(full);

	// Update previous week/next week links, if necessary
	if (!template && get_view().view != null)
		update_links();

	// Insert 'add new item' button, if needed
	if ($('.new-item').length == 0) {
		$('<button type="button" class="new-item">Add new item</button>').insertAfter('#content');
	}
}

function load_tags(taglist)
{
	delete tags;
	tags = new Tags();

	var len  = taglist.length;
	for (var i = 0; i < len; i++) {
		tags.add(new Tag(taglist[i]));
	}
}

function load_items(things, full)
{
	if (full) {
		delete items;
		items = new Items();
	}

	var len = things.length;
	for (var i = 0; i < len; i++) {
		items.add_or_update(new Item(things[i]));
	}
}

