import {ReactElementType} from 'shared/ReactTypes'
import {Props, Key, Ref} from 'shared/ReactTypes'
import {Container} from 'hostConfig'

import {FunctionComponent, WorkTag, HostComponent} from './workTags'
import {Flags, NoFlags} from './fiberFlags'

export class FiberNode {
	type: any
	tag: WorkTag
	pendingProps: Props
	key: Key
	stateNode: any
	ref: Ref

	return: FiberNode | null
	sibling: FiberNode | null
	child: FiberNode | null
	index: number
	memoizedProps: Props | null
	memoizedState: any
	alternate: FiberNode | null
	flags: Flags
	subtreeFlags: Flags
	updateQueue: unknown

	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		//	实例
		this.tag = tag
		this.key = key
		//	比如一个HostComponent <div> stageNode保存的就是这个div对应的Dom
		this.stateNode = null
		this.type = null

		//	节点之间的关系 构成树状结构
		this.return = null //指向父fiberNode
		this.sibling = null //	右边的兄弟fiberNode
		this.child = null // 子fiberNode
		this.index = 0 // 比如 <ul>li*3</ul> 中 第一个li的index就是0

		this.ref = null

		//	作为工作单元
		this.pendingProps = pendingProps //	工作开始时的props
		this.memoizedProps = null //	工作完成后的props
		this.memoizedState = null
		this.updateQueue = null

		this.alternate = null //	current <-> workInProgress
		//	副作用
		this.flags = NoFlags
		this.subtreeFlags = NoFlags
	}
}

/**
 * 定义整个根Fiber
 *
 * FiberRootNode  -current->  hostRootFiber
 * hostRootFiber -stateNode-> FiberRootNode
 *
 * hostRootFiber -child->  App Fiber
 * App Fiber     -return-> hostRootFiber
 */
export class FiberRootNode {
	container: Container
	current: FiberNode
	finishedWork: FiberNode | null //	指向更新完成以后的【hostRootFiber】
	constructor(container: Container, hostRootFiber: FiberNode) {
		this.container = container
		this.current = hostRootFiber
		hostRootFiber.stateNode = this
		this.finishedWork = null
	}
}

//	创建workInProgress
export function createWorkInProgress(current: FiberNode, pendingProps: Props) {
	let wip = current.alternate

	if (wip === null) {
		//	mount 阶段
		wip = new FiberNode(current.tag, pendingProps, current.key)
		wip.stateNode = current.stateNode

		wip.alternate = current
		current.alternate = wip
	} else {
		//	update 阶段
		wip.pendingProps = pendingProps
		wip.flags = NoFlags //	清除之前的副作用
	}
	//	复用current
	wip.type = current.type
	wip.updateQueue = current.updateQueue
	wip.child = current.child
	wip.memoizedProps = current.memoizedProps
	wip.memoizedState = current.memoizedState

	return wip
}

//	根据element创建一个Fiber
export function createFiberFromElement(element: ReactElementType) {
	const {type, key, props} = element
	let fiberTag: WorkTag = FunctionComponent
	// 比如<div>xxx</div>这种 typeof就是 'div' 的string
	if (typeof type === 'string') {
		fiberTag = HostComponent
	} else if (typeof type !== 'function' && __DEV__) {
		console.warn('为定义的type类型', element)
	}
	const fiber = new FiberNode(fiberTag, props, key)
	fiber.type = type
	return fiber
}