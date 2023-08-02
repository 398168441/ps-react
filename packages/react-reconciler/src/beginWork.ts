import {reconcileChildFibers, mountChildFibers} from './childFibers'
import {ReactElementType} from 'shared/ReactTypes'
import {UpdateQueue, processUpdateQueue} from './updateQueue'
import {
	HostRoot,
	HostComponent,
	HostText,
	FunctionComponent,
	Fragment,
	ContextProvider
} from './workTags'
import {FiberNode} from './fiber'
import {renderWithHooks} from './fiberHooks'
import {Lane} from './fiberLanes'
import {Ref} from './fiberFlags'
import {pushProvider} from './fiberContext'

/**
 * 递归中的递阶段
 * 比较jsx生成的ReactElement和之前的fiberNode，再返回子fiberNode
 */
export const beginWork = (wip: FiberNode, renderLane: Lane) => {
	switch (wip.tag) {
		case HostRoot:
			return updateHostRoot(wip, renderLane)
		case HostComponent:
			return updateHostComponent(wip)
		case HostText:
			/**
			 * <div>唱跳rap篮球</div>
			 * 这个{唱跳rap篮球} HostText 没有子节点
			 * 所以直接return null 开始completeWork
			 */
			return null
		case FunctionComponent:
			return updateFunctionComponent(wip, renderLane)
		case Fragment:
			return updateFragment(wip)
		case ContextProvider:
			return updateContextProvider(wip)
		default:
			if (__DEV__) {
				console.warn('beginWork未实现的类型')
			}
			break
	}

	return null
}

/**
 * 如果shouldComponentUpdate为false，如何感知子孙组件中有Context Consume???
 * react 会执行 bailout 优化
 *
 * 在react中会向下遍历子孙节点
 * 从这个provider向下找到消费了这个context的组件
 * 找到了会依次向上标记存在context变化
 *
 * 标记后就不会执行bailout性能优化 依然继续执行beginWork
 *
 */
function updateContextProvider(wip: FiberNode) {
	const providerType = wip.type
	const context = providerType._context
	const newProps = wip.pendingProps

	pushProvider(context, newProps.value)

	const nextChildren = newProps.children
	reconcileChildren(wip, nextChildren)
	return wip.child
}

function updateFragment(wip: FiberNode) {
	const nextChildren = wip.pendingProps
	reconcileChildren(wip, nextChildren)
	return wip.child
}

function updateFunctionComponent(wip: FiberNode, renderLane: Lane) {
	const nextChildren = renderWithHooks(wip, renderLane)
	reconcileChildren(wip, nextChildren)
	return wip.child
}

/**
 * HostRoot的beginWork流程
 * 1、计算状态的最新值
 * 2、创造子FiberNode
 *
 * HostRoot 其实就是 ReactDom.createRoot(rootElement).render(<App/>)中这个rootElement
 * 这个rootElement的子节点就是<App/>
 * diff比较的就是旧fiber和jsx 生成新fiber
 * 所以这里调用reconcileChildren比较rootElement的子节点<App/>对应的jsx和<App/>的旧Fiber 生成新的<App/>的新fiber
 */
// 其实这里就是生成<App/>的新fiber
function updateHostRoot(wip: FiberNode, renderLane: Lane) {
	const baseState = wip.memoizedState
	const updateQueue = wip.updateQueue as UpdateQueue<Element>
	const pending = updateQueue.shared.pending
	// 拿出来计算后把updateQueue置为null
	updateQueue.shared.pending = null

	//	1、这里返回的memoizedState其实就是<App/>这个element
	const {memoizedState} = processUpdateQueue(baseState, pending, renderLane)
	wip.memoizedState = memoizedState

	//	2、所以nextChildren就是wip.memoizedState
	const nextChildren = wip.memoizedState
	reconcileChildren(wip, nextChildren)
	return wip.child
}

/**
 * HostComponent不像HostRoot，是没办法触发更新的
 * HostComponent 的beginWork工作流程
 * 1、创建子FiberNode
 */
function updateHostComponent(wip: FiberNode) {
	/**
	 * 比如<div><span>123</span></div> 这个span就是 div HostComponent 的{chidren}
	 * 这个 {childrend} 就是props里
	 *  */
	const nextChildren = wip.pendingProps.children
	markRef(wip.alternate, wip)
	reconcileChildren(wip, nextChildren)
	return wip.child
}

//	返回子FiberNode
function reconcileChildren(wip: FiberNode, children: ReactElementType) {
	const current = wip.alternate
	/**
	 * 对于HostRoot在renderRoot的初始化时createWorkInProgress中
	 * 已经为HostRoot的wip.alernate赋值root.current
	 * 所以整个mount阶段只会为HostRoot插入Placement
	 * HostRoot往下每一个节点不会插入Placement副作用
	 * 这样就可以构建好「离屏DOM树」后，对<App/>执行1次Placement操作
	 * */
	if (current !== null) {
		//	update
		wip.child = reconcileChildFibers(wip, current.child, children)
	} else {
		//	mount
		wip.child = mountChildFibers(wip, null, children)
	}
}

//	标记Ref
function markRef(current: FiberNode | null, workInProgress: FiberNode) {
	const ref = workInProgress.ref
	if (
		(current === null && ref !== null) ||
		(current !== null && current.ref !== ref)
	) {
		workInProgress.flags |= Ref
	}
}
