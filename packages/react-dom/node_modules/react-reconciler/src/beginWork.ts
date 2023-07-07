import {reconcileChildFibers, mountChildFibers} from './childFibers'
import {ReactElementType} from 'shared/ReactTypes'
import {UpdateQueue, processUpdateQueue} from './updateQueue'
import {
	HostRoot,
	HostComponent,
	HostText,
	FunctionComponent,
	Fragment
} from './workTags'
import {FiberNode} from './fiber'
import {renderWithHooks} from './fiberHooks'
import {Lane} from './fiberLanes'

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
		default:
			if (__DEV__) {
				console.warn('beginWork未实现的类型')
			}
			break
	}

	return null
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
 */
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
