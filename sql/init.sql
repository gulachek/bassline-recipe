CREATE TABLE recipe (
	id INTEGER PRIMARY KEY,
	title TEXT NOT NULL DEFAULT "New Recipe",
	owner_uid INTEGER NOT NULL,
	is_published INTEGER NOT NULL DEFAULT 0,
	courtesy_of TEXT, -- who gave the author the recipe?
	is_vegan INTEGER NOT NULL DEFAULT 0,
	course INTEGER NOT NULL DEFAULT 1, -- dessert, main dish, etc
	notes TEXT,
	save_token TEXT
);

CREATE TABLE ingredients (
	id INTEGER PRIMARY KEY,
	recipe INTEGER NOT NULL,
	order_index INTEGER NOT NULL,
	value TEXT
);

CREATE TABLE directions (
	id INTEGER PRIMARY KEY,
	recipe INTEGER NOT NULL,
	order_index INTEGER NOT NULL,
	value TEXT
);
