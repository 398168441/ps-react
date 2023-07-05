import {FiberNode} from 'react-reconciler/src/fiber'
import {HostText} from 'react-reconciler/src/workTags'
/**
 * 描述宿主环境的文件
 */

export type Container = Element
export type Instance = Element
export type TextInstance = Text

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

// commit阶段执行Update
export const commitUpdate = (fiber: FiberNode) => {
	switch (fiber.tag) {
		case HostText:
			const text = fiber.memoizedProps.content
			commitTextUpdate(fiber.stateNode, text)
			break
		default:
			break
	}
}

//	commit阶段执行text节点的Update
function commitTextUpdate(TextInstance: TextInstance, content: string) {
	TextInstance.textContent = content
}

// 移除节点
export function removeChild(
	child: Instance | TextInstance,
	container: Container
) {
	container.removeChild(child)
}
