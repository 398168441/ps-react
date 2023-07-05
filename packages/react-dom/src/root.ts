import {ReactElementType} from 'shared/ReactTypes'
import {
	createContainer,
	updateContainer
} from 'react-reconciler/src/fiberReconciler'
import {Container} from 'hostConfig'
import {initEvent} from './SyntheticEvent'

// ReactDom.createRoot(rootElement).render(<App/>)

export const createRoot = (container: Container) => {
	const root = createContainer(container)

	return {
		render(element: ReactElementType) {
			// 在这里初始化合成事件 当前只实现了 click
			initEvent(container, 'click')
			return updateContainer(element, root)
		}
	}
}
