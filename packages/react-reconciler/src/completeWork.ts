import {NoFlags, Update} from './fiberFlags'
import {
	appendInitialChild,
	Container,
	createInstance,
	createTextInstance
} from 'hostConfig'
import {HostComponent, HostText, HostRoot, FunctionComponent} from './workTags'
/**
 * 递归中的归阶段
 * 需要解决的问题：
 * 1、对于Host类型的FiberNode: 构建离屏DOM树
 * 2、标记Update Flag
 */
import {FiberNode} from './fiber'
import {updateFiberProps} from 'react-dom/src/SyntheticEvent'

const markUpdate = (fiber: FiberNode) => {
	fiber.flags |= Update
}

export const completeWork = (wip: FiberNode) => {
	const newProps = wip.pendingProps
	const current = wip.alternate

	switch (wip.tag) {
		case HostComponent:
			if (current !== null && wip.stateNode) {
				// update 阶段
				/**
				 * 1、判断props的变化 比如 {onClick: xx} -> {onClick: xxx} 、{className: 'a'}-> {className: 'ab'}
				 * 2、有变化 就标记一个 Update Flags
				 * 3、标记了Update Flags就可以在commit阶段的commitUpdate函数里处理HostComponent对应的dom的属性修改
				 */
				// 暂时直接全部修改
				updateFiberProps(wip.stateNode, newProps)
			} else {
				// mount 阶段
				// 1、构建DOM
				const instance = createInstance(wip.type, newProps)
				// 2、将DOM插入DOM树中
				appendAllChildren(instance, wip)
				wip.stateNode = instance
			}
			bubbleProperties(wip)
			return null
		case HostText:
			if (current !== null && wip.stateNode) {
				// update 阶段
				// 比较新旧text
				const oldText = current.memoizedProps?.content
				const newText = newProps.content
				//	如果不相等则标记 Update 的flags
				if (oldText !== newText) {
					markUpdate(wip)
				}
			} else {
				// mount 阶段
				// 1、构建DOM
				// const instance = createTextInstance(wip.type, newProps)
				const instance = createTextInstance(newProps.content)
				// 2、文本节点没有子节点，不需要执行append操作
				wip.stateNode = instance
			}
			bubbleProperties(wip)
			return null
		case HostRoot:
			bubbleProperties(wip)
			return null
		case FunctionComponent:
			bubbleProperties(wip)
			return null
		default:
			if (__DEV__) {
				console.warn('未处理的completeWork情况', wip)
			}
			break
	}
}

function appendAllChildren(parent: Container, wip: FiberNode) {
	// 从wip的child开始挂载
	let node = wip.child
	while (node !== null) {
		//	只有 HostComponent 和 HostText 对应的DOM节点才是真正的DOM，才执行插入
		if (node.tag === HostComponent || node.tag === HostText) {
			appendInitialChild(parent, node.stateNode)
		} else if (node.child !== null) {
			// 往下找
			node.child.return = node
			node = node.child
			continue
		}

		if (node === wip) {
			return
		}

		// 遍历兄弟节点 兄弟节点没有了 就往上
		while (node.sibling === null) {
			if (node.return === null || node.return === wip) {
				return
			}
			node = node.return
		}

		node.sibling.return = node.return
		node = node.sibling
	}
}

/**
 * 将子Fiber的flags冒泡到父Fiber上
 * 一直冒泡到到父Fiber
 * 这样每一颗Fiber树 从根Fiber就能判断这颗树是否有增删改的flags
 */
function bubbleProperties(wip: FiberNode) {
	let subtreeFlags = NoFlags
	let child = wip.child

	while (child !== null) {
		subtreeFlags |= child.subtreeFlags
		subtreeFlags |= child.flags

		child.return = wip
		child = child.sibling
	}

	wip.subtreeFlags |= subtreeFlags
}
