import {ReactElementType} from 'shared/ReactTypes'
import {
	createContainer,
	updateContainer
} from 'react-reconciler/src/fiberReconciler'
import {Container} from 'hostConfig'

// ReactDom.createRoot(rootElement).render(<App/>)

export const createRoot = (container: Container) => {
	const root = createContainer(container)

	return {
		render(element: ReactElementType) {
			return updateContainer(element, root)
		}
	}
}
