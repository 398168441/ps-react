import {ReactElementType} from 'shared/ReactTypes'

import {
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	UpdateQueue
} from './updateQueue'

import {HostRoot} from './workTags'
import {FiberNode, FiberRootNode} from './fiber'
import {Container} from 'hostConfig'
import {scheduleUpdateOnFiber} from './workLoop'
import {requestUpdateLane} from './fiberLanes'
import {unstable_ImmediatePriority, unstable_runWithPriority} from 'scheduler'

/**
 * ReactDom.createRoot(rootElement).render(<App/>)
 * createRoot 就会执行【createContainer】
 * render 就会执行【updateContainer】
 */

//  执行createRoot 创建并返回【FiberRootNode】
export function createContainer(container: Container) {
	const hostRootFiber = new FiberNode(HostRoot, {}, null)
	const root = new FiberRootNode(container, hostRootFiber)
	hostRootFiber.updateQueue = createUpdateQueue()
	return root
}

//  执行render
export function updateContainer(
	element: ReactElementType | null,
	root: FiberRootNode
) {
	/**
	 * React18 默认启用同步更新
	 * 使用并发特性后的那次更新启用并发更新
	 * 这里使用runWithPriority同步优先级调度
	 * */
	unstable_runWithPriority(unstable_ImmediatePriority, () => {
		const hostRootFiber = root.current
		const lane = requestUpdateLane()
		const update = createUpdate<ReactElementType | null>(element, lane)
		enqueueUpdate(
			hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>,
			update
		)
		// 调度 workLoop中
		scheduleUpdateOnFiber(hostRootFiber, lane)
	})

	return element
}
