import {Placement} from './fiberFlags'
import {HostText} from './workTags'
import {REACT_ELEMENT_TYPE} from 'shared/ReactSymbols'
import {ReactElementType} from 'shared/ReactTypes'
import {createFiberFromElement, FiberNode} from './fiber'

function ChildReconciler(shouldTrackEffects: boolean) {
	// 创建单个节点的 Fiber
	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild: ReactElementType
	) {
		// 根据element创建一个Fiber
		const fiber = createFiberFromElement(newChild)
		fiber.return = returnFiber
		return fiber
	}

	//  创建单个文本节点的Fiber
	function reconcileSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string
	) {
		const fiber = new FiberNode(HostText, {content}, null)
		fiber.return = returnFiber
		return fiber
	}

	//  插入单一节点
	function placeSingleChild(fiber: FiberNode) {
		//  应该追踪副作用且首屏渲染
		if (shouldTrackEffects && fiber.alternate === null) {
			fiber.flags |= Placement
		}
		return fiber
	}

	return function (
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild: ReactElementType
	) {
		//  判断当前需要创建的fiber的类型
		//  1、REACT_ELEMENT_TYPE
		if (typeof newChild === 'object' && newChild !== null) {
			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE:
					return placeSingleChild(
						reconcileSingleElement(returnFiber, currentFiber, newChild)
					)
				default:
					if (__DEV__) {
						console.warn('未实现的reconcile类型', newChild)
					}
					break
			}
		}

		//  2、多节点 ul>li*3

		// 3、文本节点
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			//
			return placeSingleChild(
				reconcileSingleTextNode(returnFiber, currentFiber, newChild)
			)
		}

		if (__DEV__) {
			console.warn('未实现的reconcile类型', newChild)
		}

		return null
	}
}

export const reconcileChildFibers = ChildReconciler(true)
export const mountChildFibers = ChildReconciler(false)
