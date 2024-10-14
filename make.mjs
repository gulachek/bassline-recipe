import { cli, Path } from 'esmakefile';
import { writeFile } from 'node:fs/promises';
import sass from 'sass';

const styles = ['recipe_page', 'view_recipe', 'my_recipes'];

cli((make) => {
	make.add('all', []);

	for (const style of styles) {
		const scss = Path.src(`static_src/${style}.scss`);
		const css = Path.build(scss.basename.replace('.scss', '.css'));
		make.add('all', css);

		make.add(css, scss, async (args) => {
			const result = sass.compile(args.abs(scss));
			await writeFile(args.abs(css), result.css, 'utf8');

			for (const url of result.loadedUrls) {
				const p = url.pathname;
				if (p) args.addPostreq(p);
			}
		});
	}
});
