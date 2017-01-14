
from setuptools import find_packages, setup


def readme():
    return open('README.rst', encoding='utf-8').read()


setup(
    name='kube-ops-view',
    packages=find_packages(),
    version='0.1',
    description='Kubernetes Operational View - read-only system dashboard for multiple K8s clusters',
    long_description=readme(),
    author='Henning Jacobs',
    url='https://github.com/hjacobs/kube-ops-view',
    keywords='kubernetes operations dashboard view k8s',
    license='GNU General Public License v3 (GPLv3)',
    classifiers=[
        'Development Status :: 3 - Alpha',
        'Intended Audience :: Developers',
        'Intended Audience :: System Administrators',
        'License :: OSI Approved :: GNU General Public License v3 (GPLv3)',
        'Operating System :: OS Independent',
        'Programming Language :: Python',
        'Programming Language :: Python :: 3.5',
        'Topic :: System :: Clustering',
        'Topic :: System :: Monitoring',
    ],
    include_package_data=True,  # needed to include JavaScript (see MANIFEST.in)
    entry_points={'console_scripts': ['kube-ops-view = kube_ops_view.main:main']}
)
