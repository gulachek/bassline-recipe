const { BuildSystem, Target, Path } = require('gulpachek');
const path = require('node:path');

const { ScssTarget } = require('./buildlib/ScssTarget');

function resolve(p)
{
	return path.resolve(__dirname, p);
}

const sys = new BuildSystem({ buildDir: resolve('assets') });

const main = new Target(sys);

const styles = [
	'recipe_page',
	'view_recipe',
	'my_recipes',
];

for (const style of styles)
{
	const target = new ScssTarget(sys, `static_src/${style}.scss`);
	main.dependsOn(target);
}

main.build();
