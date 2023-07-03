import React from 'react'
import ReactDOM from 'react-dom/client'

const App = () => {
	return (
		<div>
			<Child />
		</div>
	)
}

const Child = () => {
	return (
		<div>
			<span>ps-react</span>
		</div>
	)
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
)
