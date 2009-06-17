$(document).ready(init);

function init()
{
	// Get week ID
	var week = document.getElementById('week').value;

	// Make AJAX request
	var ajax = new AJAX(base_url, process);

	ajax.send('action=load&week=' + week);
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
}

function load_tags(xml)
{
	var list = xml.getElementsByTagName('tag');
	var len  = list.length;

	delete tags;
	tags = new Tags();

	for (var i = 0; i < len; i++) {
		var tag = tag_from_xml(list[i]);
		tags.add(tag);
	}
}

function load_items(xml)
{
	delete items;
	items = new Items();

	var things = xml.getElementsByTagName('item');

	var len = things.length;
	for (var i = 0; i < len; i++)
		items.add(item_from_xml(things[i]));
}

function tag_from_xml(xml)
{
	var id    = parseInt(xml.getAttribute('id'));
	var style = parseInt(xml.getAttribute('style'));
	var name  = xml.firstChild.nodeValue;

	return new Tag(id, name, style);
}

function item_from_xml(xml)
{
	var id       = parseInt(xml.getAttribute('id'));
	var day      = parseInt(xml.getAttribute('day'));
	var date     = xml.getElementsByTagName('date')[0].firstChild ? xml.getElementsByTagName('date')[0].firstChild.nodeValue : null;
	var event    = xml.getElementsByTagName('event')[0].firstChild.nodeValue;
	var location = xml.getElementsByTagName('location')[0].firstChild ? xml.getElementsByTagName('location')[0].firstChild.nodeValue : null;
	// Start & end times are not passed through parseInt because we want to preserve leading zeroes
	var start    = xml.getElementsByTagName('start')[0].firstChild ? xml.getElementsByTagName('start')[0].firstChild.nodeValue : null;
	var end      = xml.getElementsByTagName('end')[0].firstChild ? xml.getElementsByTagName('end')[0].firstChild.nodeValue : null;
	var done     = parseInt(xml.getAttribute('done'));
	var marked   = parseInt(xml.getAttribute('marked'));
	var tags     = tags_from_xml(xml);

	return new Item(id, day, date, event, location, start, end, done, marked, tags);
}

function tags_from_xml(xml)
{
	var list = xml.getElementsByTagName('tag');
	var len = list.length;

	if (len == 0)
		return null;

	var tags = [];

	for (var i = 0; i < len; i++) {
		var id    = parseInt(list[i].getAttribute('id'));

		tags.push(id);
	}
	return tags;
}
