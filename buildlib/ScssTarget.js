const { Target, Path } = require('gulpachek');
const sass = require('sass');
const fs = require('node:fs');

class ScssTarget extends Target {
	_srcPath;

	constructor(sys, src) {
		const srcPath = Path.from(src);
		const components = [...srcPath.components];
		const last = components.pop();
		const destPath = Path.dest(last.replace(/\.scss$/, '.css'));
		super(sys, destPath);
		this._srcPath = srcPath;
	}

	deps() {
		return this._srcPath;
	}

	recipe(cb)
	{
		try {
			console.log('sass', this.sys.abs(this._srcPath));
			const result = sass.compile(this.sys.abs(this._srcPath));
			fs.writeFile(this.abs, result.css, cb);
		} catch (ex) {
			cb(ex);
		}
	}
}

module.exports = {
	ScssTarget
};
