// eslint-disable-next-line @typescript-eslint/no-var-requires
const {defaults} = require('jest-config')

module.exports = {
	...defaults,
	rootDir: process.cwd(),
	modulePathIgnorePatterns: ['<rootDir>/.history'],
	//  寻找第三方依赖从哪里解析
	moduleDirectories: [
		// 对于 React ReactDOM
		'dist/node_modules',
		// 对于第三方依赖
		...defaults.moduleDirectories
	],
	testEnvironment: 'jsdom'
}
