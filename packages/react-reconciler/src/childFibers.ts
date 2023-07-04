import {ChildDeletion, Placement} from './fiberFlags'
import {HostText} from './workTags'
import {REACT_ELEMENT_TYPE} from 'shared/ReactSymbols'
import {Props, ReactElementType} from 'shared/ReactTypes'
import {createFiberFromElement, createWorkInProgress, FiberNode} from './fiber'

function ChildReconciler(shouldTrackEffects: boolean) {
	// 删除旧的Fiber
	function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
		if (!shouldTrackEffects) {
			return
		}

		if (returnFiber.deletions === null) {
			returnFiber.deletions = [childToDelete]
			returnFiber.flags |= ChildDeletion
		} else {
			// 在加入第一个child的时候已经标记了ChildDeletion
			returnFiber.deletions.push(childToDelete)
		}
	}

	// 创建单个节点的 Fiber
	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		/**
		 *
		 * 1、比较是否可以复用current fiber
		 *    比较key，如果key【不同】，不能复用
		 *    比较type，如果type【不同】，不能复用
		 *    如果key与type都【相同】，则可复用
		 * 2、不能复用，则创建新的（同mount流程），可以复用则复用旧的
		 * 3、注意：对于同一个fiberNode，即使反复更新，current、wip这两个fiberNode会重复使用
		 */
		const {key, type} = element
		work: if (currentFiber !== null) {
			// update 阶段
			if (currentFiber.key === key) {
				// 比较完可以 再比较type
				if (element.$$typeof === REACT_ELEMENT_TYPE) {
					// 先判断element是一个有效的ReactElement
					if (currentFiber.type === type) {
						// type相同则可复用
						const existing = useFiber(currentFiber, element.props)
						// 复用后把return指向父节点
						existing.return = returnFiber
						return existing
					}
					// type不同则需要先删除当前的Fiber 走最下面mount一样的流程创建新的Fiber
					deleteChild(returnFiber, currentFiber)
					break work
				} else {
					if (__DEV__) {
						console.warn('还未实现的react类型', element)
						break work
					}
				}
			} else {
				// 删除掉旧的Fiber 还是走最下面mount一样的流程创建新的Fiber
				deleteChild(returnFiber, currentFiber)
			}
		}

		// 根据element创建一个Fiber
		const fiber = createFiberFromElement(element)
		fiber.return = returnFiber
		return fiber
	}

	//  创建单个文本节点的Fiber
	function reconcileSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string
	) {
		// 判断
		if (currentFiber !== null) {
			//	HostText 是否
			if (currentFiber.tag === HostText) {
				//	类型没变 可以复用 修改下content
				const existing = useFiber(currentFiber, {content})
				existing.return = returnFiber
				return existing
			}
			// 不是HostText 则删除 走最下面创建新的
			deleteChild(returnFiber, currentFiber)
		}
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

	// 生成子Fiber函数
	return function reconcileChildFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: ReactElementType
	) {
		//  判断当前需要创建的fiber的类型

		//  1、单节点 REACT_ELEMENT_TYPE
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

		//  3、文本节点
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			//
			return placeSingleChild(
				reconcileSingleTextNode(returnFiber, currentFiber, newChild)
			)
		}

		// 兜底 直接删除 稳当点
		if (currentFiber !== null) {
			deleteChild(returnFiber, currentFiber)
		}

		if (__DEV__) {
			console.warn('未实现的reconcile类型', newChild)
		}

		return null
	}
}

function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
	const clone = createWorkInProgress(fiber, pendingProps)
	clone.index = 0
	clone.sibling = null
	return clone
}

export const reconcileChildFibers = ChildReconciler(true)
export const mountChildFibers = ChildReconciler(false)
