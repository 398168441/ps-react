/**
 * 描述宿主环境的文件
 */

export type Container = Element
export type Instance = Element

// 创建dom实例
// export const createInstance = (type: string, props: any): Instance => {
export const createInstance = (type: string): Instance => {
	// todo props
	const element = document.createElement(type)
	return element
}

// appendChild
export const appendInitialChild = (
	parent: Instance | Container,
	child: Instance
) => {
	parent.appendChild(child)
}

// 创建文本节点
export const createTextInstance = (content: string) => {
	return document.createTextNode(content)
}

export const appendChildToContainer = appendInitialChild
