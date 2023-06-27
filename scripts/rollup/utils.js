import path from 'path'
import fs from 'fs'

import ts from 'rollup-plugin-typescript2'
import cjs from '@rollup/plugin-commonjs'

const pkgPath = path.resolve(__dirname, '../../packages')
const distPath = path.resolve(__dirname, '../../dist/node_modules')

// 解析包的路径
export function resolvePkgPath(pkgName, isDist) {
	if (isDist) {
		return `${distPath}/${pkgName}`
	}
	return `${pkgPath}/${pkgName}`
}

//	获取包下面的package.json
export function getPackageJson(pkgName) {
	//  先获取路径
	const path = `${resolvePkgPath(pkgName)}/package.json`
	const str = fs.readFileSync(path, {encoding: 'utf-8'})
	return JSON.parse(str)
}

export function getBaseRollupPlugins({typescript = {}} = {}) {
	return [cjs(), ts(typescript)]
}
